import React, { useState } from 'react';
import {
  Check,
  FileText,
  Link2,
  Loader2,
  Play,
  Save,
  Shuffle,
} from 'lucide-react';
import { apiUrl } from '../lib/api';
import { formatDuration } from '../lib/format';
import type {
  ImportedTrackMatch,
  Playlist,
  PlaylistImportResponse,
  Track,
} from '../types/music';
import { TrackArtwork } from './TrackArtwork';

interface ImportViewProps {
  onPlayPlaylist: (tracks: Track[]) => void;
  onPlaySingle: (track: Track, list: Track[]) => void;
  onSavePlaylist: (playlist: Playlist) => Promise<void>;
}

const SAMPLE_TEXT_LIST = `Tulus - Hati-Hati di Jalan
Hindia - Evaluasi
Nadin Amizah - Bertaut
Sheila On 7 - Dan
Pamungkas - To The Bone`;

export const ImportView: React.FC<ImportViewProps> = ({
  onPlayPlaylist,
  onPlaySingle,
  onSavePlaylist,
}) => {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaylistImportResponse | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const runImport = async (payload: { url?: string; rawText?: string }) => {
    setLoading(true);
    setError(null);
    setSavedNotice(false);
    try {
      const res = await fetch(apiUrl('/api/import-playlist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengimpor daftar putar.');
      }
      setResult(data as PlaylistImportResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mencocokkan lagu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'url') {
      void runImport({ url: urlInput });
    } else {
      void runImport({ rawText: textInput });
    }
  };

  const swapAlternative = (idx: number, alt: Track) => {
    if (!result) return;
    const nextItems: ImportedTrackMatch[] = result.items.map((item, i) => {
      if (i !== idx) return item;
      const previous = item.matchedTrack;
      const nextAlts = [
        ...(previous ? [previous] : []),
        ...item.alternatives.filter((a) => a.id !== alt.id),
      ];
      return {
        ...item,
        status: 'matched',
        matchedTrack: alt,
        alternatives: nextAlts,
      };
    });
    setResult({
      ...result,
      items: nextItems,
      matchedCount: nextItems.filter((i) => i.matchedTrack !== null).length,
    });
  };

  const matchedTracks: Track[] = result
    ? result.items.map((i) => i.matchedTrack).filter((t): t is Track => t !== null)
    : [];

  const handleSave = async () => {
    if (!result || matchedTracks.length === 0) return;
    const playlist: Playlist = {
      id: `pl-${Date.now()}`,
      name: result.playlistName,
      description: `Diimpor dari ${
        result.origin === 'spotify-import'
          ? 'Spotify'
          : result.origin === 'youtube-import'
            ? 'YouTube Playlist'
            : 'Daftar Teks'
      } · ${matchedTracks.length} lagu cocok`,
      coverUrl: result.coverUrl || matchedTracks[0]?.thumbnail || '',
      origin: result.origin,
      originUrl: result.originUrl,
      tracks: matchedTracks,
      createdAt: Date.now(),
    };
    await onSavePlaylist(playlist);
    setSavedNotice(true);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F5F7]">
          Impor Daftar Putar Eksternal
        </h1>
        <p className="text-sm text-[#9CA3AF] max-w-2xl">
          Tempel tautan playlist publik Spotify atau YouTube (atau salin daftar lagu dalam bentuk
          teks). Joytify mencocokkan setiap lagu ke sumber audio-only publik secara otomatis.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="max-w-full overflow-x-auto touch-pan-x no-scrollbar">
        <div className="inline-flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-[#13161B]/85 border border-white/[0.07]">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              mode === 'url'
                ? 'bg-[var(--joytify-accent)] text-[#0B0D10] font-semibold'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Link2 size={15} />
            <span>Tautan Spotify / YouTube</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              mode === 'text'
                ? 'bg-[var(--joytify-accent)] text-[#0B0D10] font-semibold'
                : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <FileText size={15} />
            <span>Daftar Teks Lagu</span>
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-5 space-y-4"
      >
        {mode === 'url' ? (
          <div className="space-y-3">
            <label htmlFor="import-url" className="block text-xs font-medium text-[#D1D5DB]">
              URL Playlist Spotify atau YouTube Publik
            </label>
            <input
              id="import-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0B0D10] px-4 text-sm text-[#F4F5F7] placeholder:text-[#6B7280] focus:border-[#1ED760] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#9CA3AF]">Contoh cepat:</span>
              <button
                type="button"
                onClick={() => {
                  const sample = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
                  setUrlInput(sample);
                  void runImport({ url: sample });
                }}
                className="min-h-[36px] rounded-lg border border-white/10 bg-[#1A1E25] px-3 py-1 text-xs text-[#E5E7EB] hover:border-[#1ED760]/40 transition-colors"
              >
                Spotify Today&apos;s Top Hits
              </button>
              <button
                type="button"
                onClick={() => {
                  const sample = 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd';
                  setUrlInput(sample);
                  void runImport({ url: sample });
                }}
                className="min-h-[36px] rounded-lg border border-white/10 bg-[#1A1E25] px-3 py-1 text-xs text-[#E5E7EB] hover:border-[#1ED760]/40 transition-colors"
              >
                Spotify RapCaviar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="import-text" className="text-xs font-medium text-[#D1D5DB]">
                Tempel daftar lagu (satu lagu per baris, format Artis - Judul)
              </label>
              <button
                type="button"
                onClick={() => setTextInput(SAMPLE_TEXT_LIST)}
                className="text-xs font-medium text-[#1ED760] hover:underline"
              >
                Isi Contoh Indonesia
              </button>
            </div>
            <textarea
              id="import-text"
              rows={6}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={SAMPLE_TEXT_LIST}
              className="w-full rounded-xl border border-white/10 bg-[#0B0D10] p-3.5 text-sm text-[#F4F5F7] placeholder:text-[#6B7280] focus:border-[#1ED760] focus:outline-none"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-[#6B7280]">
            Maksimal 20 lagu dicocokkan per proses impor agar responsif.
          </p>
          <button
            type="submit"
            disabled={loading || (mode === 'url' ? !urlInput.trim() : !textInput.trim())}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#1ED760] px-5 py-2.5 text-sm font-semibold text-[#0B0D10] hover:bg-[#19c354] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>{loading ? 'Mencocokkan Lagu...' : 'Impor & Cocokkan'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Matched Playlist Results */}
      {result && (
        <section className="rounded-2xl border border-white/[0.07] bg-[#13161B] p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-4 min-w-0">
              <TrackArtwork
                src={result.coverUrl}
                alt={result.playlistName}
                className="w-16 h-16 rounded-xl"
                iconSize={26}
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[#F4F5F7] truncate">
                  {result.playlistName}
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-1 font-mono tabular-nums">
                  Cocok {result.matchedCount} dari {result.totalFound} lagu · Siap Audio-Only
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onPlayPlaylist(matchedTracks)}
                disabled={matchedTracks.length === 0}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#1ED760] px-4 py-2 text-xs font-semibold text-[#0B0D10] hover:bg-[#19c354] disabled:opacity-50 transition-colors"
              >
                <Play size={15} fill="currentColor" />
                <span>Putar Semua</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={matchedTracks.length === 0 || savedNotice}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1E25] px-4 py-2 text-xs font-medium text-[#F4F5F7] hover:bg-[#222730] disabled:opacity-70 transition-colors"
              >
                {savedNotice ? <Check size={15} className="text-[#1ED760]" /> : <Save size={15} />}
                <span>{savedNotice ? 'Tersimpan di Pustaka' : 'Simpan Playlist'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {result.items.map((item, idx) => (
              <div
                key={`${item.queryTitle}-${idx}`}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-[#0F1216] p-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-mono text-xs tabular-nums text-[#6B7280] w-5 text-center shrink-0">
                    {idx + 1}
                  </span>
                  {item.matchedTrack ? (
                    <button
                      type="button"
                      onClick={() => onPlaySingle(item.matchedTrack!, matchedTracks)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left group"
                    >
                      <TrackArtwork
                        src={item.matchedTrack.thumbnail}
                        alt={item.matchedTrack.title}
                        className="w-11 h-11 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#F4F5F7] group-hover:text-[#1ED760] truncate transition-colors">
                          {item.queryTitle}
                        </p>
                        <p className="text-xs text-[#9CA3AF] truncate mt-0.5">
                          {item.queryArtist}
                          <span aria-hidden="true"> · </span>
                          <span className="text-[#1ED760]">
                            Cocok: {item.matchedTrack.title}
                          </span>
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#D1D5DB] truncate">
                        {item.queryTitle}
                      </p>
                      <p className="text-xs text-amber-400 mt-0.5">
                        {item.queryArtist} · Tidak ditemukan kecocokan publik
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-8 md:pl-0">
                  {item.alternatives.length > 0 && (
                    <button
                      type="button"
                      onClick={() => swapAlternative(idx, item.alternatives[0])}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#171B22] px-2.5 py-1 text-xs text-[#D1D5DB] hover:text-white transition-colors"
                      title="Ganti dengan kandidat sumber publik lain"
                    >
                      <Shuffle size={13} />
                      <span>Ganti Sumber</span>
                    </button>
                  )}
                  <span className="font-mono text-xs tabular-nums text-[#6B7280] w-12 text-right">
                    {formatDuration(
                      item.matchedTrack?.duration || item.originalDurationSec
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
