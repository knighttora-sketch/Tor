import React, { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { apiUrl } from '../lib/api';
import type { Track } from '../types/music';
import { TrackRow } from './TrackRow';

interface SearchViewProps {
  initialQuery?: string;
  currentTrackId?: string;
  isPlaying: boolean;
  cachedTrackIds: Set<string>;
  cachingProgress: Record<string, number>;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onAddToQueue: (track: Track) => void;
  onSaveTrackToPlaylist: (track: Track) => void;
  onManualCache: (track: Track) => void;
}

const SUGGESTED_QUERIES = [
  'Tulus Hati-Hati di Jalan',
  'Lofi Hip Hop Beats',
  'Sheila On 7 Dan',
  'Ambient Synthwave',
  'Hindia Evaluasi',
  'Acoustic Guitar Chill',
];

export const SearchView: React.FC<SearchViewProps> = ({
  initialQuery = '',
  currentTrackId,
  isPlaying,
  cachedTrackIds,
  cachingProgress,
  onPlayTrack,
  onAddToQueue,
  onSaveTrackToPlaylist,
  onManualCache,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<'all' | 'youtube' | 'soundcloud' | 'audius'>('all');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');

  const executeSearch = async (
    q: string,
    src: 'all' | 'youtube' | 'soundcloud' | 'audius'
  ) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSearchedQuery(trimmed);
    try {
      const res = await fetch(
        apiUrl(`/api/search?q=${encodeURIComponent(trimmed)}&source=${encodeURIComponent(src)}`)
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pencarian gagal dijalankan.');
      }
      setResults(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi API publik.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      void executeSearch(initialQuery, source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeSearch(query, source);
  };

  const handleSourceChange = (nextSource: 'all' | 'youtube' | 'soundcloud' | 'audius') => {
    setSource(nextSource);
    if (searchedQuery) {
      void executeSearch(searchedQuery, nextSource);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F5F7]">
          Cari Audio Publik
        </h1>
        <p className="text-sm text-[#9CA3AF]">
          Tarik katalog audio dan video publik dari YouTube, SoundCloud, dan Audius untuk diputar
          dalam mode audio-only.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul lagu, nama artis, atau topik audio..."
            className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#13161B]/85 pl-11 pr-10 text-sm text-[#F4F5F7] placeholder:text-[#6B7280] focus:border-[var(--joytify-accent)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#9CA3AF] hover:text-white"
              aria-label="Hapus kata kunci"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="min-h-[46px] px-6 rounded-xl bg-[var(--joytify-accent)] text-sm font-semibold text-[#0B0D10] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
        >
          {loading ? 'Mencari...' : 'Cari Lagu'}
        </button>
      </form>

      {/* Horizontally Swipeable Source Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto max-w-full overflow-x-auto touch-pan-x no-scrollbar pb-1">
          <div
            className="inline-flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-[#13161B]/85 border border-white/[0.07]"
            role="tablist"
            aria-label="Filter sumber platform"
          >
            {[
              { id: 'all', label: 'Semua Sumber' },
              { id: 'youtube', label: 'YouTube Audio-Only' },
              { id: 'soundcloud', label: 'SoundCloud' },
              { id: 'audius', label: 'Audius Direct' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={source === tab.id}
                onClick={() =>
                  handleSourceChange(tab.id as 'all' | 'youtube' | 'soundcloud' | 'audius')
                }
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  source === tab.id
                    ? 'bg-[var(--joytify-accent)] text-[#0B0D10] font-semibold'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {searchedQuery && !loading && (
          <span className="font-mono text-xs tabular-nums text-[#9CA3AF] shrink-0">
            {results.length} hasil untuk &ldquo;{searchedQuery}&rdquo;
          </span>
        )}
      </div>

      {/* Horizontally Swipeable Quick Suggestions */}
      <div className="w-full overflow-x-auto touch-pan-x no-scrollbar">
        <div className="inline-flex flex-nowrap sm:flex-wrap gap-2 pb-1">
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => {
                setQuery(sq);
                void executeSearch(sq, source);
              }}
              className="min-h-[38px] rounded-lg border border-white/[0.08] bg-[#13161B]/80 px-3 py-1.5 text-xs text-[#D1D5DB] hover:border-[var(--joytify-accent)]/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Results Area */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-8 flex flex-col items-center justify-center gap-3 text-[#9CA3AF]">
          <Loader2 size={24} className="animate-spin text-[#1ED760]" />
          <p className="text-sm">Menghubungi API platform video & audio publik...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-3 sm:p-4 space-y-1">
          {results.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              isCurrent={currentTrackId === track.id}
              isPlaying={isPlaying}
              isCached={cachedTrackIds.has(track.id)}
              cachingPct={cachingProgress[track.id]}
              onPlay={() => onPlayTrack(track, results)}
              onAddToQueue={() => onAddToQueue(track)}
              onSaveToPlaylist={() => onSaveTrackToPlaylist(track)}
              onManualCache={() => onManualCache(track)}
            />
          ))}
        </div>
      ) : searchedQuery ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-8 text-center space-y-2">
          <p className="text-base font-medium text-[#F4F5F7]">Tidak ada hasil ditemukan</p>
          <p className="text-sm text-[#9CA3AF]">
            Coba kata kunci lain atau ubah filter sumber platform di atas.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-8 text-center space-y-2">
          <p className="text-base font-medium text-[#F4F5F7]">Mulai mencari lagu favorit Anda</p>
          <p className="text-sm text-[#9CA3AF]">
            Pilih salah satu saran di atas atau ketik judul lagu untuk memutar audio langsung.
          </p>
        </div>
      )}
    </div>
  );
};
