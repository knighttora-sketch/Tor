import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  HardDrive,
  Play,
  Trash2,
} from 'lucide-react';
import { formatBytes, formatDuration, formatRelativeTime } from '../lib/format';
import type { CacheSummary } from '../lib/smartCache';
import type { CacheSettings, Playlist, Track } from '../types/music';
import { TrackArtwork } from './TrackArtwork';

interface LibraryCacheViewProps {
  summary: CacheSummary | null;
  settings: CacheSettings;
  playlists: Playlist[];
  currentTrackId?: string;
  onUpdateSettings: (next: CacheSettings) => Promise<void>;
  onRemoveCachedTrack: (trackId: string) => Promise<void>;
  onClearAllCache: () => Promise<void>;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => Promise<void>;
}

export const LibraryCacheView: React.FC<LibraryCacheViewProps> = ({
  summary,
  settings,
  playlists,
  currentTrackId,
  onUpdateSettings,
  onRemoveCachedTrack,
  onClearAllCache,
  onPlayTrack,
  onPlayPlaylist,
  onDeletePlaylist,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  const totalBytes = summary?.totalBytes || 0;
  const maxBytes = settings.maxCacheBytes;
  const usagePct = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

  const cachedAudioTracks = summary?.entries.filter((e) => e.hasAudioBlob).map((e) => e.track) || [];

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F5F7]">
          Smart Cache Lokal &amp; Pustaka
        </h1>
        <p className="text-sm text-[#9CA3AF] max-w-2xl">
          Lagu yang sering Anda putar otomatis di-cache di penyimpanan internal peramban
          (IndexedDB) agar langsung berputar tanpa memuat ulang data dari awal.
        </p>
      </div>

      {/* 4-Column Tabular Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4">
          <p className="text-xs text-[#9CA3AF]">Kapasitas Cache Lokal</p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-[#F4F5F7]">
            {formatBytes(totalBytes)}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-[#6B7280]">
            Batas {formatBytes(maxBytes)} ({usagePct}%)
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4">
          <p className="text-xs text-[#9CA3AF]">Audio Offline Tersimpan</p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-[#1ED760]">
            {summary?.audioCachedCount || 0} lagu
          </p>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            Siap putar instan tanpa kuota
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4">
          <p className="text-xs text-[#9CA3AF]">Data Dihemat (Cache Hit)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-[#F4F5F7]">
            {formatBytes(summary?.stats.networkBytesSaved || 0)}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-[#6B7280]">
            {summary?.stats.cacheHits || 0}x pemutaran dari cache
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-4">
          <p className="text-xs text-[#9CA3AF]">Riwayat Lagu Diputar</p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-[#F4F5F7]">
            {summary?.totalPlays || 0} kali
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-[#6B7280]">
            {summary?.entries.length || 0} lagu terindeks
          </p>
        </div>
      </section>

      {/* Smart Cache Settings & Storage Bar */}
      <section className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1ED760]/10 text-[#1ED760] flex items-center justify-center shrink-0">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F4F5F7]">
                Aturan Smart Caching Otomatis
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Pembersihan LRU otomatis menghapus cache terlama saat kuota penuh
              </p>
            </div>
          </div>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={(summary?.entries.length || 0) === 0}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1E25] px-4 py-2 text-xs font-medium text-[#E5E7EB] hover:bg-rose-500/15 hover:text-rose-200 hover:border-rose-500/30 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 size={14} />
              <span>Bersihkan Cache</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onClearAllCache();
                  setConfirmClear(false);
                }}
                className="min-h-[40px] rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Konfirmasi Hapus
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[40px] rounded-xl border border-white/10 px-3.5 py-2 text-xs text-[#9CA3AF] hover:text-white"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        {/* Storage Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-[#0B0D10] overflow-hidden">
            <div
              className="h-full bg-[#1ED760] transition-all duration-300"
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {summary?.browserQuotaBytes && (
            <p className="font-mono text-[11px] tabular-nums text-[#6B7280]">
              Ruang peramban tersedia: {formatBytes(summary.browserQuotaBytes)}
            </p>
          )}
        </div>

        {/* Interactive Policy Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-medium text-[#D1D5DB]">
              Simpan cache penuh otomatis setelah diputar:
            </p>
            <div className="max-w-full overflow-x-auto touch-pan-x no-scrollbar">
              <div className="inline-flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-[#0B0D10] border border-white/[0.06]">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      void onUpdateSettings({ ...settings, autoCacheThreshold: n })
                    }
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      settings.autoCacheThreshold === n
                        ? 'bg-[var(--joytify-accent)] text-[#0B0D10] font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {n}x Putar
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <p className="text-xs font-medium text-[#D1D5DB]">
              Batas Maksimum Cache Internal:
            </p>
            <div className="max-w-full overflow-x-auto touch-pan-x no-scrollbar">
              <div className="inline-flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-[#0B0D10] border border-white/[0.06]">
                {[
                  { label: '100 MB', bytes: 100 * 1024 * 1024 },
                  { label: '150 MB', bytes: 150 * 1024 * 1024 },
                  { label: '300 MB', bytes: 300 * 1024 * 1024 },
                  { label: '500 MB', bytes: 500 * 1024 * 1024 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() =>
                      void onUpdateSettings({ ...settings, maxCacheBytes: opt.bytes })
                    }
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums whitespace-nowrap shrink-0 transition-colors ${
                      settings.maxCacheBytes === opt.bytes
                        ? 'bg-[var(--joytify-accent)] text-[#0B0D10] font-semibold'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Saved & Imported Playlists */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[#F4F5F7]">
            Playlist Tersimpan ({playlists.length})
          </h2>
          <span className="text-xs text-[#9CA3AF]">Disimpan lokal di perangkat</span>
        </div>

        {playlists.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-6 text-sm text-[#9CA3AF]">
            Belum ada playlist tersimpan. Impor daftar putar dari Spotify/YouTube atau simpan lagu
            dari halaman Jelajah &amp; Cari.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#13161B] p-3.5"
              >
                <button
                  type="button"
                  onClick={() => onPlayPlaylist(pl)}
                  className="flex items-center gap-3.5 min-w-0 flex-1 text-left group"
                >
                  <TrackArtwork
                    src={pl.coverUrl || pl.tracks[0]?.thumbnail}
                    alt={pl.name}
                    className="w-14 h-14 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#F4F5F7] group-hover:text-[#1ED760] truncate transition-colors">
                      {pl.name}
                    </p>
                    <p className="text-xs text-[#9CA3AF] truncate mt-0.5">
                      {pl.tracks.length} lagu · {pl.description}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlayPlaylist(pl)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#1ED760]/15 text-[#1ED760] hover:bg-[#1ED760] hover:text-[#0B0D10] transition-colors"
                    aria-label={`Putar playlist ${pl.name}`}
                  >
                    <Play size={17} fill="currentColor" className="ml-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeletePlaylist(pl.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-rose-400 hover:bg-white/5 transition-colors"
                    aria-label={`Hapus playlist ${pl.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* IndexedDB Cached Tracks List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#F4F5F7]">
            Daftar Lagu di Smart Cache
          </h2>
          {cachedAudioTracks.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayTrack(cachedAudioTracks[0], cachedAudioTracks)}
              className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#1ED760] hover:underline"
            >
              <HardDrive size={14} />
              <span>Putar Cache Offline</span>
            </button>
          )}
        </div>

        {!summary || summary.entries.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-6 text-sm text-[#9CA3AF]">
            Belum ada riwayat pemutaran. Putar lagu apa saja dan Smart Cache akan melacak frekuensi
            serta menyimpan cache audio secara otomatis.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-3 space-y-1">
            {summary.entries.map((entry) => (
              <div
                key={entry.trackId}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  currentTrackId === entry.trackId
                    ? 'bg-[#171C24]'
                    : 'hover:bg-[#171B22]'
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    onPlayTrack(
                      entry.track,
                      summary.entries.map((e) => e.track)
                    )
                  }
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <TrackArtwork
                    src={entry.track.thumbnail}
                    alt={entry.track.title}
                    className="w-11 h-11 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#F4F5F7] truncate">
                      {entry.track.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#9CA3AF]">
                      <span className="truncate">{entry.track.artist}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{entry.playCount}x diputar</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(entry.lastPlayedAt)}</span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    {entry.hasAudioBlob ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1ED760]">
                        <CheckCircle2 size={13} />
                        <span>Audio Offline · {formatBytes(entry.totalBytes)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#6B7280]">
                        Metadata · {formatDuration(entry.track.duration)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRemoveCachedTrack(entry.trackId)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#6B7280] hover:text-rose-400 hover:bg-white/5 transition-colors"
                    aria-label={`Hapus ${entry.track.title} dari cache`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
