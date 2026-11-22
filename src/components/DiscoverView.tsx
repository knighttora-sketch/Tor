import React from 'react';
import {
  ArrowRight,
  Disc3,
  Headphones,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Track } from '../types/music';
import { TrackArtwork } from './TrackArtwork';
import { TrackRow } from './TrackRow';

export interface CuratedCollection {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  cover: string;
}

export const CURATED_COLLECTIONS: CuratedCollection[] = [
  {
    id: 'senja-akustik',
    title: 'Senja Jakarta Akustik',
    subtitle: 'Pop Indonesia & indie santai sore hari',
    query: 'lagu indonesia akustik santai audio',
    cover: '/src/assets/images/cover_jakarta_senja_1795374192254.jpg',
  },
  {
    id: 'night-drive-lofi',
    title: 'Hujan & Malam Kota',
    subtitle: 'Lo-fi beats untuk fokus kerja & berkendara',
    query: 'lofi hip hop night drive beats audio',
    cover: '/src/assets/images/cover_lofi_night_drive_1795374191049.jpg',
  },
  {
    id: 'midnight-tape',
    title: 'Studio Tape Sessions',
    subtitle: 'Sesi akustik hangat & live unplugged',
    query: 'acoustic live session unplugged audio',
    cover: '/src/assets/images/cover_midnight_acoustic_1795374192057.jpg',
  },
  {
    id: 'analog-synth',
    title: 'Analog Synth Pulse',
    subtitle: 'Elektronik & synthwave resolusi jernih',
    query: 'synthwave chill electronic instrumental audio',
    cover: '/src/assets/images/cover_indie_synth_pulse_1795374191685.jpg',
  },
];

interface DiscoverViewProps {
  audiusTrending: Track[];
  soundcloudTrending: Track[];
  publicHits: Track[];
  lofiSession: Track[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onExploreQuery: (query: string) => void;
  onOpenImport: () => void;
  currentTrackId?: string;
  isPlaying: boolean;
  cachedTrackIds: Set<string>;
  cachingProgress: Record<string, number>;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onAddToQueue: (track: Track) => void;
  onSaveTrackToPlaylist: (track: Track) => void;
  onManualCache: (track: Track) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  audiusTrending,
  soundcloudTrending,
  publicHits,
  lofiSession,
  loading,
  error,
  onRetry,
  onExploreQuery,
  onOpenImport,
  currentTrackId,
  isPlaying,
  cachedTrackIds,
  cachingProgress,
  onPlayTrack,
  onAddToQueue,
  onSaveTrackToPlaylist,
  onManualCache,
}) => {
  return (
    <div className="space-y-10 pb-8">
      {/* Editorial Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#13161B]/80 backdrop-blur-md p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--joytify-accent)]">
              <Headphones size={15} />
              <span>Mode Audio-Only · Tanpa Penyimpanan Server</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#F4F5F7] text-balance leading-[1.15]">
              Dengarkan musik publik lebih ringan, hemat kuota, dan siap cache lokal.
            </h1>
            <p className="text-sm sm:text-base text-[#9CA3AF] max-w-2xl leading-relaxed">
              Joytify menarik katalog audio dan video publik secara langsung melalui API terbuka,
              memutarnya dalam mode audio murni, serta menyimpan cache cerdas di perangkat Anda agar
              lagu favorit berputar instan.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const first = audiusTrending[0] || publicHits[0];
                  if (first) {
                    onPlayTrack(first, audiusTrending.length ? audiusTrending : publicHits);
                  }
                }}
                disabled={loading || (audiusTrending.length === 0 && publicHits.length === 0)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#1ED760] px-5 py-2.5 text-sm font-semibold text-[#0B0D10] hover:bg-[#19c354] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Disc3 size={17} />
                <span>Putar Tren Sekarang</span>
              </button>
              <button
                type="button"
                onClick={onOpenImport}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1E25] px-5 py-2.5 text-sm font-medium text-[#F4F5F7] hover:bg-[#222730] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Impor Playlist Spotify</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            {CURATED_COLLECTIONS.slice(0, 2).map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => onExploreQuery(col.query)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]"
              >
                <TrackArtwork
                  src={col.cover}
                  alt={col.title}
                  className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-sm font-semibold text-white truncate">{col.title}</p>
                  <p className="text-xs text-[#D1D5DB] truncate mt-0.5">Ketuk untuk cari</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Curated Discovery Mixes */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg sm:text-xl font-semibold text-[#F4F5F7]">
            Pilihan Suasana Audio
          </h2>
          <span className="text-xs text-[#9CA3AF]">Pencarian Langsung API Publik</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CURATED_COLLECTIONS.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => onExploreQuery(col.query)}
              className="group text-left rounded-2xl border border-white/[0.07] bg-[#13161B] p-3 hover:bg-[#181C23] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl mb-3">
                <TrackArtwork
                  src={col.cover}
                  alt={col.title}
                  className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <p className="text-sm font-semibold text-[#F4F5F7] truncate">{col.title}</p>
              <p className="mt-1 text-xs text-[#9CA3AF] line-clamp-2 leading-relaxed">
                {col.subtitle}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Error / Loading State */}
      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-amber-200">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 shrink-0"
          >
            <RefreshCw size={14} />
            <span>Coba Muat Ulang</span>
          </button>
        </div>
      )}

      {loading ? (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map((col) => (
            <div
              key={col}
              className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4 space-y-3"
            >
              <div className="h-5 w-48 rounded bg-white/10 animate-pulse" />
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ))}
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audius Direct Stream Trending (Cacheable Locally in IndexedDB) */}
          <section className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4 sm:p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2 px-2">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#F4F5F7]">
                  Tren Audius Terbuka
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Stream langsung & mendukung Smart Cache offline penuh
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#6B7280] shrink-0">
                {audiusTrending.length} lagu
              </span>
            </div>

            {audiusTrending.length === 0 ? (
              <p className="px-2 py-6 text-sm text-[#9CA3AF]">
                Belum ada data tren Audius yang termuat.
              </p>
            ) : (
              <div className="space-y-1">
                {audiusTrending.slice(0, 6).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    isCurrent={currentTrackId === track.id}
                    isPlaying={isPlaying}
                    isCached={cachedTrackIds.has(track.id)}
                    cachingPct={cachingProgress[track.id]}
                    onPlay={() => onPlayTrack(track, audiusTrending)}
                    onAddToQueue={() => onAddToQueue(track)}
                    onSaveToPlaylist={() => onSaveTrackToPlaylist(track)}
                    onManualCache={() => onManualCache(track)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SoundCloud Audio-Only Hits */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#13161B]/80 backdrop-blur-md p-4 sm:p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2 px-2">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#F4F5F7]">
                  SoundCloud Pilihan
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Musik independen &amp; remix publik langsung dari SoundCloud
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#6B7280] shrink-0">
                {soundcloudTrending.length} lagu
              </span>
            </div>

            {soundcloudTrending.length === 0 ? (
              <p className="px-2 py-6 text-sm text-[#9CA3AF]">
                Belum ada data SoundCloud yang termuat.
              </p>
            ) : (
              <div className="space-y-1">
                {soundcloudTrending.slice(0, 6).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    isCurrent={currentTrackId === track.id}
                    isPlaying={isPlaying}
                    isCached={cachedTrackIds.has(track.id)}
                    onPlay={() => onPlayTrack(track, soundcloudTrending)}
                    onAddToQueue={() => onAddToQueue(track)}
                    onSaveToPlaylist={() => onSaveTrackToPlaylist(track)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Public Video Platform Audio-Only Hits */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#13161B]/80 backdrop-blur-md p-4 sm:p-5 space-y-3 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-2 px-2">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#F4F5F7]">
                  Populer Video Publik
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Diputar khusus audio (audio-only) tanpa memuat video berat
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#6B7280] shrink-0">
                {publicHits.length} lagu
              </span>
            </div>

            {publicHits.length === 0 ? (
              <p className="px-2 py-6 text-sm text-[#9CA3AF]">
                Belum ada data hits publik yang termuat.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {publicHits.slice(0, 8).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    isCurrent={currentTrackId === track.id}
                    isPlaying={isPlaying}
                    isCached={cachedTrackIds.has(track.id)}
                    onPlay={() => onPlayTrack(track, publicHits)}
                    onAddToQueue={() => onAddToQueue(track)}
                    onSaveToPlaylist={() => onSaveTrackToPlaylist(track)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Lo-Fi Focus Session */}
      {lofiSession.length > 0 && (
        <section className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4 sm:p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-2 px-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#F4F5F7]">
                Sesi Fokus & Lo-Fi Audio
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Putar berurutan sebagai latar kerja atau belajar
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPlayTrack(lofiSession[0], lofiSession)}
              className="min-h-[44px] px-3 text-xs font-semibold text-[#1ED760] hover:underline whitespace-nowrap shrink-0"
            >
              Putar Semua
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {lofiSession.slice(0, 6).map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isCurrent={currentTrackId === track.id}
                isPlaying={isPlaying}
                isCached={cachedTrackIds.has(track.id)}
                onPlay={() => onPlayTrack(track, lofiSession)}
                onAddToQueue={() => onAddToQueue(track)}
                onSaveToPlaylist={() => onSaveTrackToPlaylist(track)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Zero-Hosting Policy Transparency Card */}
      <section className="rounded-2xl border border-white/[0.07] bg-[#111419] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#1ED760]/10 text-[#1ED760] flex items-center justify-center shrink-0">
          <ShieldCheck size={20} />
        </div>
        <div className="space-y-1 text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
          <p className="font-semibold text-[#F4F5F7]">
            Arsitektur Tanpa Penyimpanan Server (Zero-Hosting)
          </p>
          <p>
            Joytify tidak mengunggah, menyimpan, atau memiliki hak cipta file musik apa pun di
            server kami. Seluruh pemutaran berasal langsung dari API platform video & audio publik,
            sementara cache lokal hanya disimpan secara privat di penyimpanan internal perangkat Anda.
          </p>
        </div>
      </section>
    </div>
  );
};
