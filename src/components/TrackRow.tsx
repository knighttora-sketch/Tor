import React from 'react';
import {
  CheckCircle2,
  HardDriveDownload,
  ListPlus,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import { formatDuration } from '../lib/format';
import type { Track } from '../types/music';
import { TrackArtwork } from './TrackArtwork';

interface TrackRowProps {
  track: Track;
  index?: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isCached?: boolean;
  cachingPct?: number;
  onPlay: () => void;
  onAddToQueue: () => void;
  onSaveToPlaylist?: () => void;
  onManualCache?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  isCurrent,
  isPlaying,
  isCached = false,
  cachingPct,
  onPlay,
  onAddToQueue,
  onSaveToPlaylist,
  onManualCache,
}) => {
  const sourceLabel = isCached
    ? 'Cache Lokal'
    : track.source === 'youtube'
      ? 'YouTube Audio-Only'
      : track.source === 'soundcloud'
        ? 'SoundCloud'
        : 'Audius Direct';

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-colors border ${
        isCurrent
          ? 'bg-[#171C24] border-[#1ED760]/30'
          : 'bg-transparent border-transparent hover:bg-[#14181F] hover:border-white/[0.06]'
      }`}
    >
      {typeof index === 'number' && (
        <span className="hidden sm:inline-flex w-6 justify-center font-mono text-xs tabular-nums text-[#6B7280] shrink-0">
          {index + 1}
        </span>
      )}

      <button
        type="button"
        onClick={onPlay}
        className="relative flex items-center gap-3 flex-1 min-w-0 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760] rounded-lg"
        aria-label={`Putar ${track.title} oleh ${track.artist}`}
      >
        <div className="relative shrink-0">
          <TrackArtwork
            src={track.thumbnail}
            alt={track.title}
            className="w-12 h-12 rounded-lg"
          />
          <span
            className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 transition-opacity ${
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isCurrent && isPlaying ? (
              <Pause size={18} className="text-[#1ED760]" fill="currentColor" />
            ) : (
              <Play size={18} className="text-white ml-0.5" fill="currentColor" />
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium truncate ${
              isCurrent ? 'text-[#1ED760]' : 'text-[#F4F5F7]'
            }`}
          >
            {track.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#9CA3AF] truncate">
            <span className="truncate">{track.artist}</span>
            <span aria-hidden="true">·</span>
            <span className={isCached ? 'text-[#1ED760] font-medium shrink-0' : 'shrink-0'}>
              {sourceLabel}
            </span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {track.supportsBinaryCache && onManualCache && (
          <button
            type="button"
            onClick={onManualCache}
            disabled={isCached || typeof cachingPct === 'number'}
            title={isCached ? 'Tersimpan di Cache Lokal' : 'Simpan ke Cache Lokal'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#1ED760] hover:bg-white/5 disabled:opacity-70 transition-colors"
            aria-label={isCached ? 'Sudah tersimpan di cache' : 'Simpan ke cache lokal'}
          >
            {typeof cachingPct === 'number' ? (
              <span className="font-mono text-[11px] tabular-nums text-[#1ED760]">
                {cachingPct}%
              </span>
            ) : isCached ? (
              <CheckCircle2 size={17} className="text-[#1ED760]" />
            ) : (
              <HardDriveDownload size={17} />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onAddToQueue}
          title="Tambahkan ke Antrean"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Tambahkan ke antrean"
        >
          <ListPlus size={17} />
        </button>

        {onSaveToPlaylist && (
          <button
            type="button"
            onClick={onSaveToPlaylist}
            title="Simpan ke Playlist"
            className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Simpan ke playlist"
          >
            <Plus size={17} />
          </button>
        )}

        <span className="hidden sm:inline-block w-12 text-right font-mono text-xs tabular-nums text-[#6B7280] pr-1">
          {formatDuration(track.duration)}
        </span>
      </div>
    </div>
  );
};
