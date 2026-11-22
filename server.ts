import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface ApiTrack {
  id: string;
  source: 'youtube' | 'audius' | 'soundcloud';
  sourceId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  genre?: string;
  viewCount?: string;
  supportsBinaryCache: boolean;
  permalinkUrl?: string;
}

// Short-lived in-memory metadata cache (NO audio files are ever stored on the server)
const searchCache = new Map<string, { expiresAt: number; tracks: ApiTrack[] }>();
let trendingCache: { expiresAt: number; data: unknown } | null = null;
let soundCloudClientCache: { expiresAt: number; clientId: string } | null = null;

function parseDurationText(text: string | undefined): number {
  if (!text) return 0;
  const parts = text.trim().split(':').map((n) => Number(n));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  // Block private IPv4 ranges
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  return false;
}

async function searchYouTubePublic(query: string, limit = 12): Promise<ApiTrack[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const marker = 'var ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return [];
    const jsonStart = startIdx + marker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    if (endIdx === -1) return [];
    const data = JSON.parse(html.slice(jsonStart, endIdx));

    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ||
      [];
    const tracks: ApiTrack[] = [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const video = item?.videoRenderer;
        if (!video?.videoId) continue;
        const durationText =
          video?.lengthText?.simpleText ||
          video?.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;
        const duration = parseDurationText(durationText);
        // Skip livestreams (0 duration) or ultra-long compilations (> 25 mins) when searching songs
        if (duration <= 0 || duration > 1500) continue;

        const title =
          video?.title?.runs?.map((r: { text?: string }) => r.text || '').join('') ||
          'Untitled Audio';
        const artist =
          video?.ownerText?.runs?.[0]?.text ||
          video?.longBylineText?.runs?.[0]?.text ||
          'Public Channel';
        const thumbs = video?.thumbnail?.thumbnails || [];
        const thumbUrl =
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
        const viewCount = video?.shortViewCountText?.simpleText || undefined;

        tracks.push({
          id: `yt:${video.videoId}`,
          source: 'youtube',
          sourceId: video.videoId,
          title,
          artist: artist.replace(/ - Topic$/i, ''),
          duration,
          thumbnail: thumbUrl,
          viewCount,
          supportsBinaryCache: false,
        });

        if (tracks.length >= limit) break;
      }
      if (tracks.length >= limit) break;
    }
    return tracks;
  } catch {
    return [];
  }
}

async function searchAudiusPublic(query: string, limit = 8): Promise<ApiTrack[]> {
  try {
    const url = `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        title?: string;
        duration?: number;
        genre?: string;
        play_count?: number;
        user?: { name?: string };
        artwork?: Record<string, string>;
      }>;
    };
    const items = Array.isArray(json?.data) ? json.data : [];
    return items
      .filter((t) => Boolean(t.id && t.title))
      .map((t) => ({
        id: `aud:${t.id}`,
        source: 'audius' as const,
        sourceId: String(t.id),
        title: String(t.title),
        artist: t.user?.name || 'Audius Artist',
        duration: Number(t.duration) || 180,
        thumbnail:
          t.artwork?.['480x480'] ||
          t.artwork?.['150x150'] ||
          t.artwork?.['1000x1000'] ||
          '',
        genre: t.genre || undefined,
        viewCount: t.play_count ? `${t.play_count.toLocaleString('id-ID')} putar` : undefined,
        supportsBinaryCache: true,
      }));
  } catch {
    return [];
  }
}

async function getAudiusTrending(limit = 10): Promise<ApiTrack[]> {
  try {
    const res = await fetch(`https://api.audius.co/v1/tracks/trending?limit=${limit}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        title?: string;
        duration?: number;
        genre?: string;
        play_count?: number;
        user?: { name?: string };
        artwork?: Record<string, string>;
      }>;
    };
    const items = Array.isArray(json?.data) ? json.data : [];
    return items
      .filter((t) => Boolean(t.id && t.title))
      .map((t) => ({
        id: `aud:${t.id}`,
        source: 'audius' as const,
        sourceId: String(t.id),
        title: String(t.title),
        artist: t.user?.name || 'Audius Artist',
        duration: Number(t.duration) || 180,
        thumbnail:
          t.artwork?.['480x480'] ||
          t.artwork?.['150x150'] ||
          t.artwork?.['1000x1000'] ||
          '',
        genre: t.genre || undefined,
        viewCount: t.play_count ? `${t.play_count.toLocaleString('id-ID')} putar` : undefined,
        supportsBinaryCache: true,
      }));
  } catch {
    return [];
  }
}

async function getSoundCloudClientId(): Promise<string | null> {
  if (soundCloudClientCache && soundCloudClientCache.expiresAt > Date.now()) {
    return soundCloudClientCache.clientId;
  }
  try {
    const html = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    }).then((r) => r.text());
    const scripts = [...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js/g)].map(
      (m) => m[0]
    );
    for (const sUrl of scripts.slice(-5).reverse()) {
      const js = await fetch(sUrl, { signal: AbortSignal.timeout(7000) }).then((r) => r.text());
      const m =
        js.match(/client_id:"([a-zA-Z0-9]{20,40})"/) ||
        js.match(/client_id=([a-zA-Z0-9]{20,40})/);
      if (m?.[1]) {
        soundCloudClientCache = {
          clientId: m[1],
          expiresAt: Date.now() + 6 * 60 * 60 * 1000,
        };
        return m[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function searchSoundCloudPublic(query: string, limit = 10): Promise<ApiTrack[]> {
  try {
    const clientId = await getSoundCloudClientId();
    if (!clientId) return [];
    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&limit=${limit}&client_id=${encodeURIComponent(clientId)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      collection?: Array<{
        id?: number;
        title?: string;
        duration?: number;
        genre?: string;
        playback_count?: number;
        artwork_url?: string | null;
        permalink_url?: string;
        user?: { username?: string; avatar_url?: string };
      }>;
    };
    const items = Array.isArray(json?.collection) ? json.collection : [];
    return items
      .filter((t) => Boolean(t.id && t.title))
      .map((t) => {
        const rawArt = t.artwork_url || t.user?.avatar_url || '';
        const thumb = rawArt ? rawArt.replace('-large.', '-t500x500.') : '';
        return {
          id: `sc:${t.id}`,
          source: 'soundcloud' as const,
          sourceId: String(t.id),
          title: String(t.title),
          artist: t.user?.username || 'SoundCloud Creator',
          duration: Math.max(1, Math.round((Number(t.duration) || 180000) / 1000)),
          thumbnail: thumb,
          genre: t.genre || undefined,
          viewCount: t.playback_count
            ? `${t.playback_count.toLocaleString('id-ID')} putar`
            : undefined,
          supportsBinaryCache: false,
          permalinkUrl: t.permalink_url,
        };
      });
  } catch {
    return [];
  }
}

async function cachedSearch(query: string, source: string, limit = 15): Promise<ApiTrack[]> {
  const key = `${source}:${query.toLowerCase().trim()}:${limit}`;
  const hit = searchCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.tracks;
  }

  let tracks: ApiTrack[] = [];
  if (source === 'audius') {
    tracks = await searchAudiusPublic(query, limit);
  } else if (source === 'youtube') {
    tracks = await searchYouTubePublic(query, limit);
  } else if (source === 'soundcloud') {
    tracks = await searchSoundCloudPublic(query, limit);
  } else {
    const [yt, sc, aud] = await Promise.all([
      searchYouTubePublic(query, Math.ceil(limit * 0.45)),
      searchSoundCloudPublic(query, Math.ceil(limit * 0.45)),
      searchAudiusPublic(query, Math.ceil(limit * 0.35)),
    ]);
    // Interleave YouTube, SoundCloud, and Audius results
    const maxLen = Math.max(yt.length, sc.length, aud.length);
    for (let i = 0; i < maxLen; i++) {
      if (yt[i]) tracks.push(yt[i]);
      if (sc[i]) tracks.push(sc[i]);
      if (aud[i]) tracks.push(aud[i]);
    }
    tracks = tracks.slice(0, limit);
  }

  if (tracks.length > 0) {
    searchCache.set(key, { expiresAt: Date.now() + 5 * 60 * 1000, tracks });
  }
  return tracks;
}

async function fetchSpotifyEmbedPlaylist(playlistId: string) {
  const embedUrl = `https://open.spotify.com/embed/playlist/${encodeURIComponent(playlistId)}`;
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) {
    throw new Error('Gagal membaca daftar putar Spotify publik.');
  }
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Format halaman Spotify tidak dikenali atau playlist bersifat privat.');
  }
  const data = JSON.parse(match[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity || !Array.isArray(entity.trackList)) {
    throw new Error('Daftar lagu tidak ditemukan pada tautan Spotify tersebut.');
  }
  const coverUrl =
    entity?.coverArt?.sources?.[0]?.url ||
    entity?.visualIdentity?.image?.[0]?.url ||
    '';

  const rawTracks = (entity.trackList as Array<{
    title?: string;
    subtitle?: string;
    duration?: number;
  }>)
    .slice(0, 20)
    .map((t) => ({
      title: String(t.title || 'Untitled').trim(),
      artist: String(t.subtitle || '').replace(/\u00a0/g, ' ').trim(),
      durationSec: Math.round((Number(t.duration) || 180000) / 1000),
    }));

  return {
    name: String(entity.name || entity.title || 'Spotify Imported Playlist'),
    coverUrl,
    tracks: rawTracks,
  };
}

async function fetchYouTubePlaylist(listId: string) {
  const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) {
    throw new Error('Gagal membaca daftar putar YouTube publik.');
  }
  const html = await res.text();
  const marker = 'var ytInitialData = ';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    throw new Error('Playlist YouTube tidak dapat diakses atau bersifat privat.');
  }
  const jsonStart = startIdx + marker.length;
  const endIdx = html.indexOf(';</script>', jsonStart);
  const data = JSON.parse(html.slice(jsonStart, endIdx));

  const title =
    data?.metadata?.playlistMetadataRenderer?.title ||
    data?.header?.playlistHeaderRenderer?.title?.simpleText ||
    'YouTube Imported Playlist';

  const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const items =
    tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
      ?.contents?.[0]?.playlistVideoListRenderer?.contents || [];

  const tracks: ApiTrack[] = [];
  for (const item of items) {
    const v = item?.playlistVideoRenderer;
    if (!v?.videoId) continue;
    const vidTitle =
      v?.title?.runs?.map((r: { text?: string }) => r.text || '').join('') || 'Untitled';
    const vidArtist = v?.shortBylineText?.runs?.[0]?.text || 'Public Channel';
    const dur = Number(v?.lengthSeconds) || parseDurationText(v?.lengthText?.simpleText) || 180;
    const thumbs = v?.thumbnail?.thumbnails || [];
    const thumb = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

    tracks.push({
      id: `yt:${v.videoId}`,
      source: 'youtube',
      sourceId: v.videoId,
      title: vidTitle,
      artist: vidArtist.replace(/ - Topic$/i, ''),
      duration: dur,
      thumbnail: thumb,
      supportsBinaryCache: false,
    });
    if (tracks.length >= 25) break;
  }

  return {
    name: title,
    coverUrl: tracks[0]?.thumbnail || '',
    tracks,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIdx < items.length) {
      const current = nextIdx++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  // Allow Capacitor Android APK WebView origins to reach /api/*
  const ALLOWED_APK_ORIGINS = new Set([
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'http://localhost:3000',
  ]);
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_APK_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hostingMode: 'zero-storage-public-api' });
  });

  app.get('/api/trending', async (_req, res) => {
    try {
      if (trendingCache && trendingCache.expiresAt > Date.now()) {
        res.json(trendingCache.data);
        return;
      }

      const [audiusTop, soundcloudTop, indoPop, lofiFocus, indieMix] = await Promise.all([
        getAudiusTrending(10),
        searchSoundCloudPublic('indie pop chill beats', 8),
        searchYouTubePublic('lagu indonesia pop hits audio official', 8),
        searchYouTubePublic('lofi chill beats study audio', 6),
        searchYouTubePublic('indie acoustic evening session audio', 6),
      ]);

      const payload = {
        audiusTrending: audiusTop,
        soundcloudTrending: soundcloudTop,
        publicHits: indoPop,
        lofiSession: lofiFocus,
        indieAcoustic: indieMix,
      };

      trendingCache = { expiresAt: Date.now() + 5 * 60 * 1000, data: payload };
      res.json(payload);
    } catch {
      res.status(502).json({ error: 'Gagal mengambil daftar tren publik.' });
    }
  });

  app.get('/api/search', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const source =
      req.query.source === 'youtube' ||
      req.query.source === 'audius' ||
      req.query.source === 'soundcloud'
        ? req.query.source
        : 'all';

    if (!rawQ || rawQ.length > 120) {
      res.status(400).json({ error: 'Kata kunci pencarian harus diisi (maks 120 karakter).' });
      return;
    }

    try {
      const tracks = await cachedSearch(rawQ, source, 18);
      res.json({ query: rawQ, source, tracks });
    } catch {
      res.status(502).json({ error: 'Gagal menghubungi API platform publik.' });
    }
  });

  // Streams public Audius audio cleanly to browser with Range support so IndexedDB Smart Cache can store Blobs
  app.get('/api/audius-stream/:trackId', async (req, res) => {
    const trackId = req.params.trackId || '';
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(trackId)) {
      res.status(400).json({ error: 'ID track tidak valid.' });
      return;
    }

    try {
      const entryUrl = `https://api.audius.co/v1/tracks/${encodeURIComponent(trackId)}/stream`;
      const headers: Record<string, string> = {};
      if (typeof req.headers.range === 'string') {
        headers.Range = req.headers.range;
      }

      const upstream = await fetch(entryUrl, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      const finalUrl = new URL(upstream.url);
      if (finalUrl.protocol !== 'https:' || isPrivateOrLocalHostname(finalUrl.hostname)) {
        res.status(403).json({ error: 'Sumber stream ditolak oleh kebijakan keamanan.' });
        return;
      }

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: 'Stream audio publik tidak tersedia.' });
        return;
      }

      res.status(upstream.status);
      const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
      for (const h of passHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Koneksi ke stream audio publik terputus.' });
      } else {
        res.end();
      }
    }
  });

  app.post('/api/import-playlist', async (req, res) => {
    const urlInput = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText.trim() : '';

    if (!urlInput && !rawText) {
      res.status(400).json({ error: 'Masukkan tautan playlist Spotify/YouTube atau daftar lagu.' });
      return;
    }

    try {
      // 1. Spotify public playlist URL
      const spotifyMatch = urlInput.match(
        /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?playlist\/([a-zA-Z0-9]{10,32})/i
      );
      if (spotifyMatch) {
        const sp = await fetchSpotifyEmbedPlaylist(spotifyMatch[1]);
        const items = await runWithConcurrency(sp.tracks, 4, async (t) => {
          const query = `${t.artist} ${t.title} audio`.trim();
          const candidates = await cachedSearch(query, 'youtube', 4);
          return {
            queryTitle: t.title,
            queryArtist: t.artist,
            originalDurationSec: t.durationSec,
            status: candidates.length > 0 ? ('matched' as const) : ('unmatched' as const),
            matchedTrack: candidates[0] || null,
            alternatives: candidates.slice(1, 4),
          };
        });

        res.json({
          playlistName: sp.name,
          coverUrl: sp.coverUrl || items.find((i) => i.matchedTrack)?.matchedTrack?.thumbnail || '',
          origin: 'spotify-import',
          originUrl: urlInput,
          totalFound: items.length,
          matchedCount: items.filter((i) => i.status === 'matched').length,
          items,
        });
        return;
      }

      // 2. YouTube public playlist URL
      const ytListMatch = urlInput.match(
        /^https?:\/\/(?:www\.|music\.)?youtube\.com\/playlist\?.*list=([a-zA-Z0-9_-]{8,64})/i
      );
      if (ytListMatch) {
        const yt = await fetchYouTubePlaylist(ytListMatch[1]);
        const items = yt.tracks.map((track) => ({
          queryTitle: track.title,
          queryArtist: track.artist,
          originalDurationSec: track.duration,
          status: 'matched' as const,
          matchedTrack: track,
          alternatives: [],
        }));
        res.json({
          playlistName: yt.name,
          coverUrl: yt.coverUrl,
          origin: 'youtube-import',
          originUrl: urlInput,
          totalFound: items.length,
          matchedCount: items.length,
          items,
        });
        return;
      }

      if (urlInput && !rawText) {
        res.status(400).json({
          error:
            'Gunakan tautan playlist Spotify (open.spotify.com/playlist/...) atau YouTube (youtube.com/playlist?list=...).',
        });
        return;
      }

      // 3. Raw text tracklist import
      const lines: string[] = rawText
        .split(/\r?\n/)
        .map((l: string) => l.replace(/^\d+[.)]\s*/, '').trim())
        .filter((l: string) => l.length >= 2)
        .slice(0, 20);

      if (lines.length === 0) {
        res.status(400).json({ error: 'Tidak ada baris lagu yang valid untuk diimpor.' });
        return;
      }

      const items = await runWithConcurrency(lines, 4, async (line: string) => {
        const parts = line.split(/\s+[-–—]\s+/);
        const queryArtist = parts.length >= 2 ? parts[0].trim() : '';
        const queryTitle = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : line;
        const candidates = await cachedSearch(`${line} audio`, 'all', 4);
        return {
          queryTitle,
          queryArtist: queryArtist || candidates[0]?.artist || 'Publik',
          originalDurationSec: candidates[0]?.duration || 0,
          status: candidates.length > 0 ? ('matched' as const) : ('unmatched' as const),
          matchedTrack: candidates[0] || null,
          alternatives: candidates.slice(1, 4),
        };
      });

      res.json({
        playlistName: `Impor Daftar Lagu (${items.length})`,
        coverUrl: items.find((i) => i.matchedTrack)?.matchedTrack?.thumbnail || '',
        origin: 'text-import',
        totalFound: items.length,
        matchedCount: items.filter((i) => i.status === 'matched').length,
        items,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengimpor daftar putar.';
      res.status(502).json({ error: msg });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Joytify server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
