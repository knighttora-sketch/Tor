import type {
  CacheSettings,
  CachedTrackEntry,
  CustomThemeConfig,
  Playlist,
  Track,
} from '../types/music';
import { apiUrl } from './api';
import { DEFAULT_THEME_CONFIG } from './themeUtils';

const DB_NAME = 'joytify_smart_cache_v1';
const DB_VERSION = 1;

const STORE_TRACKS = 'tracks';
const STORE_BLOBS = 'blobs';
const STORE_PLAYLISTS = 'playlists';
const STORE_META = 'meta';

export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  autoCacheThreshold: 2,
  maxCacheBytes: 150 * 1024 * 1024, // 150 MB
  autoCacheArtwork: true,
  audioOnlyLowBandwidth: true,
};

export interface CacheStats {
  cacheHits: number;
  networkBytesSaved: number;
}

export interface CacheSummary {
  entries: CachedTrackEntry[];
  totalBytes: number;
  audioCachedCount: number;
  totalPlays: number;
  stats: CacheStats;
  browserQuotaBytes: number | null;
  browserUsageBytes: number | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'trackId' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

function txPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function txDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCacheSettings(): Promise<CacheSettings> {
  try {
    const db = await openDB();
    const record = await txGet<{ key: string; value: CacheSettings }>(db, STORE_META, 'settings');
    db.close();
    return record?.value ? { ...DEFAULT_CACHE_SETTINGS, ...record.value } : DEFAULT_CACHE_SETTINGS;
  } catch {
    return DEFAULT_CACHE_SETTINGS;
  }
}

export async function saveCacheSettings(settings: CacheSettings): Promise<void> {
  const db = await openDB();
  await txPut(db, STORE_META, { key: 'settings', value: settings });
  db.close();
}

export async function getCacheStats(): Promise<CacheStats> {
  try {
    const db = await openDB();
    const record = await txGet<{ key: string; value: CacheStats }>(db, STORE_META, 'stats');
    db.close();
    return record?.value || { cacheHits: 0, networkBytesSaved: 0 };
  } catch {
    return { cacheHits: 0, networkBytesSaved: 0 };
  }
}

async function incrementCacheHit(bytesSaved: number): Promise<void> {
  try {
    const db = await openDB();
    const current =
      (await txGet<{ key: string; value: CacheStats }>(db, STORE_META, 'stats'))?.value || {
        cacheHits: 0,
        networkBytesSaved: 0,
      };
    await txPut(db, STORE_META, {
      key: 'stats',
      value: {
        cacheHits: current.cacheHits + 1,
        networkBytesSaved: current.networkBytesSaved + bytesSaved,
      },
    });
    db.close();
  } catch {
    // Ignore stats persistence errors
  }
}

async function evictLRUIfNeeded(
  db: IDBDatabase,
  incomingBytes: number,
  maxBytes: number,
  protectTrackId: string
): Promise<void> {
  const entries = await txGetAll<CachedTrackEntry>(db, STORE_TRACKS);
  let currentTotal = entries.reduce((sum, e) => sum + (e.totalBytes || 0), 0);

  if (currentTotal + incomingBytes <= maxBytes) return;

  // Evict least recently played entries with cached audio blobs first
  const candidates = entries
    .filter((e) => e.trackId !== protectTrackId && e.totalBytes > 0)
    .sort((a, b) => a.lastPlayedAt - b.lastPlayedAt);

  for (const cand of candidates) {
    if (currentTotal + incomingBytes <= maxBytes) break;
    await txDelete(db, STORE_BLOBS, `audio:${cand.trackId}`);
    await txDelete(db, STORE_BLOBS, `art:${cand.trackId}`);
    currentTotal -= cand.totalBytes;
    await txPut<CachedTrackEntry>(db, STORE_TRACKS, {
      ...cand,
      hasAudioBlob: false,
      hasArtworkBlob: false,
      totalBytes: 0,
    });
  }
}

export async function cacheTrackAudio(
  track: Track,
  onProgress?: (percent: number) => void
): Promise<CachedTrackEntry | null> {
  if (!track.supportsBinaryCache || track.source !== 'audius') {
    return null;
  }

  const streamUrl = apiUrl(`/api/audius-stream/${encodeURIComponent(track.sourceId)}`);
  const res = await fetch(streamUrl);
  if (!res.ok) {
    throw new Error('Gagal mengunduh stream audio untuk cache lokal.');
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  const contentType = res.headers.get('content-type') || 'audio/mpeg';

  let audioBlob: Blob;
  if (res.body && contentLength > 0) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress?.(Math.min(99, Math.round((received / contentLength) * 100)));
      }
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    audioBlob = new Blob([merged], { type: contentType });
  } else {
    audioBlob = await res.blob();
  }
  onProgress?.(100);

  const settings = await getCacheSettings();
  const db = await openDB();
  const existing = await txGet<CachedTrackEntry>(db, STORE_TRACKS, track.id);

  let artworkBlobSize = 0;
  if (settings.autoCacheArtwork && track.thumbnail && !existing?.hasArtworkBlob) {
    try {
      const artRes = await fetch(track.thumbnail);
      if (artRes.ok) {
        const artBlob = await artRes.blob();
        await txPut(db, STORE_BLOBS, { key: `art:${track.id}`, blob: artBlob });
        artworkBlobSize = artBlob.size;
      }
    } catch {
      // Artwork CORS fallback handled gracefully
    }
  } else if (existing?.hasArtworkBlob) {
    const artRec = await txGet<{ key: string; blob: Blob }>(db, STORE_BLOBS, `art:${track.id}`);
    artworkBlobSize = artRec?.blob?.size || 0;
  }

  await evictLRUIfNeeded(db, audioBlob.size, settings.maxCacheBytes, track.id);
  await txPut(db, STORE_BLOBS, { key: `audio:${track.id}`, blob: audioBlob });

  const updated: CachedTrackEntry = {
    trackId: track.id,
    track,
    playCount: existing?.playCount || 1,
    lastPlayedAt: Date.now(),
    cachedAt: Date.now(),
    totalBytes: audioBlob.size + artworkBlobSize,
    hasAudioBlob: true,
    hasArtworkBlob: existing?.hasArtworkBlob || artworkBlobSize > 0,
    lastPositionSec: existing?.lastPositionSec || 0,
  };

  await txPut(db, STORE_TRACKS, updated);
  db.close();
  return updated;
}

export async function recordTrackPlay(track: Track): Promise<{
  entry: CachedTrackEntry;
  shouldAutoCache: boolean;
}> {
  const settings = await getCacheSettings();
  const db = await openDB();
  const existing = await txGet<CachedTrackEntry>(db, STORE_TRACKS, track.id);

  const nextPlayCount = (existing?.playCount || 0) + 1;
  let hasArtworkBlob = existing?.hasArtworkBlob || false;
  let totalBytes = existing?.totalBytes || 0;

  if (settings.autoCacheArtwork && track.thumbnail && !hasArtworkBlob) {
    try {
      const artRes = await fetch(track.thumbnail);
      if (artRes.ok) {
        const artBlob = await artRes.blob();
        await txPut(db, STORE_BLOBS, { key: `art:${track.id}`, blob: artBlob });
        hasArtworkBlob = true;
        totalBytes += artBlob.size;
      }
    } catch {
      // Cross-origin artwork without CORS is rendered normally via <img>
    }
  }

  const entry: CachedTrackEntry = {
    trackId: track.id,
    track,
    playCount: nextPlayCount,
    lastPlayedAt: Date.now(),
    cachedAt: existing?.cachedAt || Date.now(),
    totalBytes,
    hasAudioBlob: existing?.hasAudioBlob || false,
    hasArtworkBlob,
    lastPositionSec: existing?.lastPositionSec || 0,
  };

  await txPut(db, STORE_TRACKS, entry);
  db.close();

  const shouldAutoCache =
    track.supportsBinaryCache &&
    !entry.hasAudioBlob &&
    nextPlayCount >= settings.autoCacheThreshold;

  return { entry, shouldAutoCache };
}

export async function getCachedAudioUrl(trackId: string): Promise<{
  url: string;
  bytes: number;
} | null> {
  try {
    const db = await openDB();
    const record = await txGet<{ key: string; blob: Blob }>(db, STORE_BLOBS, `audio:${trackId}`);
    db.close();
    if (!record?.blob) return null;
    await incrementCacheHit(record.blob.size);
    return {
      url: URL.createObjectURL(record.blob),
      bytes: record.blob.size,
    };
  } catch {
    return null;
  }
}

export async function savePlaybackPosition(trackId: string, sec: number): Promise<void> {
  try {
    const db = await openDB();
    const existing = await txGet<CachedTrackEntry>(db, STORE_TRACKS, trackId);
    if (existing) {
      await txPut(db, STORE_TRACKS, {
        ...existing,
        lastPositionSec: Math.floor(sec),
        lastPlayedAt: Date.now(),
      });
    }
    db.close();
  } catch {
    // Ignore
  }
}

export async function removeCachedTrack(trackId: string): Promise<void> {
  const db = await openDB();
  await txDelete(db, STORE_BLOBS, `audio:${trackId}`);
  await txDelete(db, STORE_BLOBS, `art:${trackId}`);
  await txDelete(db, STORE_TRACKS, trackId);
  db.close();
}

export async function clearAllAudioCache(): Promise<void> {
  const db = await openDB();
  const entries = await txGetAll<CachedTrackEntry>(db, STORE_TRACKS);
  for (const e of entries) {
    await txDelete(db, STORE_BLOBS, `audio:${e.trackId}`);
    await txDelete(db, STORE_BLOBS, `art:${e.trackId}`);
    await txDelete(db, STORE_TRACKS, e.trackId);
  }
  db.close();
}

export async function getCacheSummary(): Promise<CacheSummary> {
  const db = await openDB();
  const entries = await txGetAll<CachedTrackEntry>(db, STORE_TRACKS);
  db.close();

  const stats = await getCacheStats();
  const sorted = entries.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  const totalBytes = sorted.reduce((sum, e) => sum + (e.totalBytes || 0), 0);
  const audioCachedCount = sorted.filter((e) => e.hasAudioBlob).length;
  const totalPlays = sorted.reduce((sum, e) => sum + (e.playCount || 0), 0);

  let browserQuotaBytes: number | null = null;
  let browserUsageBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      browserQuotaBytes = est.quota ?? null;
      browserUsageBytes = est.usage ?? null;
    } catch {
      // Ignore
    }
  }

  return {
    entries: sorted,
    totalBytes,
    audioCachedCount,
    totalPlays,
    stats,
    browserQuotaBytes,
    browserUsageBytes,
  };
}

// Local User Playlists Persistence
export async function getSavedPlaylists(): Promise<Playlist[]> {
  try {
    const db = await openDB();
    const list = await txGetAll<Playlist>(db, STORE_PLAYLISTS);
    db.close();
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function savePlaylistLocal(playlist: Playlist): Promise<void> {
  const db = await openDB();
  await txPut(db, STORE_PLAYLISTS, playlist);
  db.close();
}

export async function deletePlaylistLocal(id: string): Promise<void> {
  const db = await openDB();
  await txDelete(db, STORE_PLAYLISTS, id);
  db.close();
}

// Local Custom Gallery Theme Persistence
export async function getThemeConfig(): Promise<CustomThemeConfig> {
  try {
    const db = await openDB();
    const record = await txGet<{ key: string; value: CustomThemeConfig }>(
      db,
      STORE_META,
      'themeConfig'
    );
    db.close();
    return record?.value ? { ...DEFAULT_THEME_CONFIG, ...record.value } : DEFAULT_THEME_CONFIG;
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

export async function saveThemeConfig(config: CustomThemeConfig): Promise<void> {
  const db = await openDB();
  await txPut(db, STORE_META, { key: 'themeConfig', value: config });
  db.close();
}

