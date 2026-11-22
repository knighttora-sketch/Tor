import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  HardDriveDownload,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDuration } from '../lib/format';
import type { RepeatMode, Track } from '../types/music';
import { TrackArtwork } from './TrackArtwork';

interface PlayerBarProps {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playingFromCache: boolean;
  isCurrentCached: boolean;
  cachingProgress?: number;
  playerError: string | null;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onVolumeChange: (v: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onPlayFromQueue: (track: Track) => void;
  onRemoveFromQueue: (trackId: string) => void;
  onManualCache: (track: Track) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack,
  queue,
  isPlaying,
  isBuffering,
  currentTime,
  duration,
  volume,
  playbackRate,
  shuffle,
  repeat,
  playingFromCache,
  isCurrentCached,
  cachingProgress,
  playerError,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onVolumeChange,
  onPlaybackRateChange,
  onToggleShuffle,
  onCycleRepeat,
  onPlayFromQueue,
  onRemoveFromQueue,
  onManualCache,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const sourceStatus = playingFromCache
    ? 'Cache Lokal · Instan'
    : currentTrack.source === 'youtube'
      ? 'Audio-Only · YouTube Publik'
      : currentTrack.source === 'soundcloud'
        ? 'Audio-Only · SoundCloud'
        : 'Stream Langsung · Audius';

  return (
    <>
      {/* Expanded Full-Screen Audio-Only Sheet */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-[#0B0D10]/98 backdrop-blur-xl flex flex-col overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Pemutar Audio-Only Penuh"
        >
          <div className="max-w-5xl w-full mx-auto px-5 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/5"
              aria-label="Tutup pemutar penuh"
            >
              <ChevronDown size={22} />
            </button>
            <div className="text-center min-w-0 px-2">
              <p className="text-xs font-medium text-[#1ED760] truncate">{sourceStatus}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowQueue((q) => !q)}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                showQueue
                  ? 'bg-[#1ED760]/15 text-[#1ED760]'
                  : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
              }`}
              aria-label="Tampilkan antrean putar"
            >
              <ListMusic size={20} />
            </button>
          </div>

          <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div
              className={`${
                showQueue ? 'lg:col-span-6' : 'lg:col-span-12 max-w-md mx-auto w-full'
              } space-y-6`}
            >
              <div className="aspect-square w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                <TrackArtwork
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full"
                  iconSize={48}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#F4F5F7] truncate">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm text-[#9CA3AF] truncate mt-1">{currentTrack.artist}</p>
                </div>

                {currentTrack.supportsBinaryCache && (
                  <button
                    type="button"
                    onClick={() => onManualCache(currentTrack)}
                    disabled={isCurrentCached || typeof cachingProgress === 'number'}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#151920] px-3.5 py-2 text-xs font-medium text-[#E5E7EB] hover:border-[#1ED760]/40 disabled:opacity-70 shrink-0"
                  >
                    <HardDriveDownload size={15} className="text-[#1ED760]" />
                    <span>
                      {typeof cachingProgress === 'number'
                        ? `${cachingProgress}%`
                        : isCurrentCached
                          ? 'Tersimpan'
                          : 'Cache'}
                    </span>
                  </button>
                )}
              </div>

              {playerError && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  {playerError}
                </p>
              )}

              {/* Seek Bar */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  aria-label="Posisi audio"
                  className="joytify-range w-full"
                  style={{
                    background: `linear-gradient(to right, #1ED760 ${progressPct}%, rgba(255,255,255,0.12) ${progressPct}%)`,
                  }}
                />
                <div className="flex justify-between font-mono text-xs tabular-nums text-[#9CA3AF]">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Primary Playback Controls */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onToggleShuffle}
                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                    shuffle ? 'text-[#1ED760]' : 'text-[#9CA3AF] hover:text-white'
                  }`}
                  aria-label="Acak antrean"
                >
                  <Shuffle size={19} />
                </button>

                <button
                  type="button"
                  onClick={onPrev}
                  className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-[#F4F5F7] hover:bg-white/5"
                  aria-label="Lagu sebelumnya"
                >
                  <SkipBack size={24} fill="currentColor" />
                </button>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="w-16 h-16 flex items-center justify-center rounded-full bg-[#1ED760] text-[#0B0D10] hover:bg-[#19c354] shadow-lg transition-transform active:scale-95"
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                >
                  {isBuffering ? (
                    <Loader2 size={26} className="animate-spin" />
                  ) : isPlaying ? (
                    <Pause size={26} fill="currentColor" />
                  ) : (
                    <Play size={26} fill="currentColor" className="ml-1" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onNext}
                  className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl text-[#F4F5F7] hover:bg-white/5"
                  aria-label="Lagu berikutnya"
                >
                  <SkipForward size={24} fill="currentColor" />
                </button>

                <button
                  type="button"
                  onClick={onCycleRepeat}
                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                    repeat !== 'off' ? 'text-[#1ED760]' : 'text-[#9CA3AF] hover:text-white'
                  }`}
                  aria-label="Mode ulang"
                >
                  {repeat === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
                </button>
              </div>

              {/* Speed & Volume Footer */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#13161B]">
                  {[1, 1.25, 1.5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onPlaybackRateChange(r)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs tabular-nums transition-colors ${
                        playbackRate === r
                          ? 'bg-[#1ED760] text-[#0B0D10] font-semibold'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 w-36">
                  <button
                    type="button"
                    onClick={() => onVolumeChange(volume > 0 ? 0 : 0.85)}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#9CA3AF] hover:text-white"
                    aria-label="Bisukan volume"
                  >
                    {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={volume}
                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                    aria-label="Volume audio"
                    className="joytify-range w-full"
                    style={{
                      background: `linear-gradient(to right, #F4F5F7 ${volume * 100}%, rgba(255,255,255,0.14) ${volume * 100}%)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {showQueue && (
              <div className="lg:col-span-6 rounded-2xl border border-white/[0.07] bg-[#13161B] p-4 max-h-[65vh] overflow-y-auto space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-[#F4F5F7]">
                    Antrean Putar ({queue.length})
                  </h3>
                </div>
                {queue.map((qTrack) => (
                  <div
                    key={qTrack.id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 ${
                      qTrack.id === currentTrack.id ? 'bg-[#1A2029]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPlayFromQueue(qTrack)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <TrackArtwork
                        src={qTrack.thumbnail}
                        alt={qTrack.title}
                        className="w-10 h-10 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-medium truncate ${
                            qTrack.id === currentTrack.id ? 'text-[#1ED760]' : 'text-[#F4F5F7]'
                          }`}
                        >
                          {qTrack.title}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] truncate">{qTrack.artist}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(qTrack.id)}
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center text-[#6B7280] hover:text-rose-400"
                      aria-label={`Hapus ${qTrack.title} dari antrean`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Desktop Dock / Mobile Mini-Player (positioned cleanly above Mobile Nav) */}
      <div className="fixed left-0 right-0 bottom-[60px] lg:bottom-0 lg:left-64 z-30 border-t border-white/[0.08] bg-[#101318]/95 backdrop-blur-md">
        {/* Thin top progress indicator on mobile */}
        <div className="lg:hidden h-[2px] w-full bg-white/10">
          <div className="h-full bg-[#1ED760]" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="h-[58px] lg:h-[76px] px-3 sm:px-6 flex items-center justify-between gap-3">
          {/* Left: Track Info (Tap to expand full Audio-Only sheet) */}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-3 min-w-0 flex-1 lg:flex-initial lg:w-72 text-left group"
            aria-label="Buka layar pemutar penuh"
          >
            <TrackArtwork
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-[#F4F5F7] group-hover:text-[#1ED760] truncate transition-colors">
                {currentTrack.title}
              </p>
              <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
                {currentTrack.artist}
                <span aria-hidden="true"> · </span>
                <span className={playingFromCache ? 'text-[#1ED760]' : ''}>
                  {playingFromCache ? 'Cache Lokal' : 'Audio-Only'}
                </span>
              </p>
            </div>
            <ChevronUp size={16} className="text-[#9CA3AF] lg:hidden shrink-0" />
          </button>

          {/* Center: Desktop Playback & Seekbar */}
          <div className="hidden lg:flex flex-col items-center flex-1 max-w-xl gap-1.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggleShuffle}
                className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${
                  shuffle ? 'text-[#1ED760]' : 'text-[#9CA3AF] hover:text-white'
                }`}
                aria-label="Acak"
              >
                <Shuffle size={16} />
              </button>
              <button
                type="button"
                onClick={onPrev}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#E5E7EB] hover:text-white"
                aria-label="Sebelumnya"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1ED760] text-[#0B0D10] hover:bg-[#19c354] transition-transform active:scale-95"
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isBuffering ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#E5E7EB] hover:text-white"
                aria-label="Berikutnya"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={onCycleRepeat}
                className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ${
                  repeat !== 'off' ? 'text-[#1ED760]' : 'text-[#9CA3AF] hover:text-white'
                }`}
                aria-label="Ulang"
              >
                {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
            </div>

            <div className="w-full flex items-center gap-2.5">
              <span className="font-mono text-[11px] tabular-nums text-[#9CA3AF] w-10 text-right">
                {formatDuration(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Posisi audio"
                className="joytify-range flex-1"
                style={{
                  background: `linear-gradient(to right, #1ED760 ${progressPct}%, rgba(255,255,255,0.14) ${progressPct}%)`,
                }}
              />
              <span className="font-mono text-[11px] tabular-nums text-[#9CA3AF] w-10">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Right: Quick Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTogglePlay}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#F4F5F7]"
              aria-label={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isBuffering ? (
                <Loader2 size={20} className="animate-spin text-[#1ED760]" />
              ) : isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-white"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={19} fill="currentColor" />
            </button>

            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpanded(true);
                  setShowQueue(true);
                }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/5"
                aria-label="Antrean putar"
              >
                <ListMusic size={17} />
              </button>
              <div className="flex items-center gap-1.5 w-28">
                <button
                  type="button"
                  onClick={() => onVolumeChange(volume > 0 ? 0 : 0.85)}
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-[#9CA3AF] hover:text-white"
                  aria-label="Volume"
                >
                  {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  aria-label="Volume"
                  className="joytify-range w-full"
                  style={{
                    background: `linear-gradient(to right, #F4F5F7 ${volume * 100}%, rgba(255,255,255,0.14) ${volume * 100}%)`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
