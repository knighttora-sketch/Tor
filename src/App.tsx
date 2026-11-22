import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Database,
  Download,
  HardDrive,
  ListMusic,
  Music2,
  Palette,
  Plus,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import { DiscoverView } from './components/DiscoverView';
import { ImportView } from './components/ImportView';
import { LibraryCacheView } from './components/LibraryCacheView';
import { PlayerBar } from './components/PlayerBar';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SearchView } from './components/SearchView';
import { ThemeModal } from './components/ThemeModal';
import { useAudioEngine } from './hooks/useAudioEngine';
import { apiUrl } from './lib/api';
import { formatBytes } from './lib/format';
import {
  clearAllAudioCache,
  DEFAULT_CACHE_SETTINGS,
  deletePlaylistLocal,
  getCacheSettings,
  getCacheSummary,
  getSavedPlaylists,
  getThemeConfig,
  removeCachedTrack,
  saveCacheSettings,
  savePlaylistLocal,
  saveThemeConfig,
  type CacheSummary,
} from './lib/smartCache';
import { DEFAULT_THEME_CONFIG } from './lib/themeUtils';
import type {
  CacheSettings,
  CustomThemeConfig,
  NavTab,
  Playlist,
  Track,
} from './types/music';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [searchInitQuery, setSearchInitQuery] = useState('');

  // Trending state
  const [audiusTrending, setAudiusTrending] = useState<Track[]>([]);
  const [soundcloudTrending, setSoundcloudTrending] = useState<Track[]>([]);
  const [publicHits, setPublicHits] = useState<Track[]>([]);
  const [lofiSession, setLofiSession] = useState<Track[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // Smart Cache, Library & Custom Gallery Theme state
  const [cacheSummary, setCacheSummary] = useState<CacheSummary | null>(null);
  const [cacheSettings, setCacheSettings] = useState<CacheSettings>(DEFAULT_CACHE_SETTINGS);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [themeConfig, setThemeConfig] = useState<CustomThemeConfig>(DEFAULT_THEME_CONFIG);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Add-to-playlist modal state
  const [trackForPlaylist, setTrackForPlaylist] = useState<Track | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const refreshCacheAndLibrary = useCallback(async () => {
    const [summary, settings, savedPlaylists, savedTheme] = await Promise.all([
      getCacheSummary(),
      getCacheSettings(),
      getSavedPlaylists(),
      getThemeConfig(),
    ]);
    setCacheSummary(summary);
    setCacheSettings(settings);
    setPlaylists(savedPlaylists);
    setThemeConfig(savedTheme);
  }, []);

  const engine = useAudioEngine(() => {
    void refreshCacheAndLibrary();
  });

  // Sync dynamic CSS accent color
  useEffect(() => {
    document.documentElement.style.setProperty('--joytify-accent', themeConfig.accentColor);
  }, [themeConfig.accentColor]);

  const activeWallpaper = useMemo(
    () =>
      themeConfig.activeWallpaperId
        ? themeConfig.wallpapers.find((w) => w.id === themeConfig.activeWallpaperId) || null
        : null,
    [themeConfig.activeWallpaperId, themeConfig.wallpapers]
  );

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const res = await fetch(apiUrl('/api/trending'));
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat katalog publik.');
      }
      setAudiusTrending(Array.isArray(data.audiusTrending) ? data.audiusTrending : []);
      setSoundcloudTrending(Array.isArray(data.soundcloudTrending) ? data.soundcloudTrending : []);
      setPublicHits(Array.isArray(data.publicHits) ? data.publicHits : []);
      setLofiSession(Array.isArray(data.lofiSession) ? data.lofiSession : []);
    } catch (err) {
      setTrendingError(
        err instanceof Error ? err.message : 'Koneksi ke platform video & audio publik gagal.'
      );
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCacheAndLibrary();
    void loadTrending();
  }, [loadTrending, refreshCacheAndLibrary]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const cachedTrackIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of cacheSummary?.entries || []) {
      if (entry.hasAudioBlob) set.add(entry.trackId);
    }
    return set;
  }, [cacheSummary]);

  const handleExploreQuery = (query: string) => {
    setSearchInitQuery(query);
    setActiveTab('search');
  };

  const handleAddToQueue = (track: Track) => {
    engine.addToQueue(track);
    showToast(`Ditambahkan ke antrean: ${track.title}`);
  };

  const handleManualCache = async (track: Track) => {
    try {
      await engine.manualCacheTrack(track);
      showToast(`Tersimpan di cache lokal: ${track.title}`);
    } catch {
      showToast('Gagal menyimpan cache audio.');
    }
  };

  const handleSavePlaylist = async (playlist: Playlist) => {
    await savePlaylistLocal(playlist);
    await refreshCacheAndLibrary();
    showToast(`Playlist "${playlist.name}" disimpan ke pustaka.`);
  };

  const handleAddTrackToExistingPlaylist = async (playlist: Playlist, track: Track) => {
    const exists = playlist.tracks.some((t) => t.id === track.id);
    if (exists) {
      showToast('Lagu sudah ada di playlist ini.');
      setTrackForPlaylist(null);
      return;
    }
    const updated: Playlist = {
      ...playlist,
      tracks: [...playlist.tracks, track],
      coverUrl: playlist.coverUrl || track.thumbnail,
    };
    await savePlaylistLocal(updated);
    await refreshCacheAndLibrary();
    setTrackForPlaylist(null);
    showToast(`Disimpan ke "${playlist.name}"`);
  };

  const handleCreatePlaylistWithTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackForPlaylist || !newPlaylistName.trim()) return;
    const pl: Playlist = {
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      description: 'Playlist kustom lokal',
      coverUrl: trackForPlaylist.thumbnail,
      origin: 'custom',
      tracks: [trackForPlaylist],
      createdAt: Date.now(),
    };
    await savePlaylistLocal(pl);
    await refreshCacheAndLibrary();
    setNewPlaylistName('');
    setTrackForPlaylist(null);
    showToast(`Playlist "${pl.name}" dibuat.`);
  };

  const handleThemeChange = async (next: CustomThemeConfig) => {
    setThemeConfig(next);
    await saveThemeConfig(next);
  };

  const handleCycleRepeat = () => {
    const next = engine.repeat === 'off' ? 'all' : engine.repeat === 'all' ? 'one' : 'off';
    engine.setRepeat(next);
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'discover', label: 'Jelajah', icon: <Compass size={20} /> },
    { id: 'search', label: 'Cari', icon: <Search size={20} /> },
    { id: 'import', label: 'Impor', icon: <Download size={20} /> },
    { id: 'library', label: 'Cache & Pustaka', icon: <Database size={20} /> },
  ];

  const bottomPaddingClass = engine.currentTrack ? 'pb-36 lg:pb-24' : 'pb-20 lg:pb-8';

  return (
    <div className="relative min-h-screen bg-[#0B0D10] text-[#F4F5F7] flex flex-col lg:flex-row">
      {/* Custom User Gallery Wallpaper Background Layer */}
      {activeWallpaper && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <img
            src={activeWallpaper.dataUrl}
            alt=""
            className="w-full h-full object-cover scale-105 transition-opacity duration-300"
            style={{ filter: `blur(${themeConfig.blurPx}px)` }}
          />
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{
              backgroundColor: `rgba(11, 13, 16, ${themeConfig.dimOpacity / 100})`,
            }}
          />
        </div>
      )}

      {/* Hidden 1x1 YouTube Audio-Only Viewport */}
      <div
        id="joytify-yt-audio-host"
        className="fixed -left-[9999px] -top-[9999px] w-px h-px opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Hidden 1x1 SoundCloud Official Widget Audio-Only Viewport */}
      <iframe
        id="joytify-sc-audio-host"
        title="SoundCloud Audio Engine"
        allow="autoplay"
        src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F2362596641&auto_play=false&show_artwork=false&visual=false"
        className="fixed -left-[9999px] -top-[9999px] w-px h-px opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 border-r border-white/[0.08] bg-[#0E1115]/88 backdrop-blur-md px-4 py-5 z-20">
        <div className="flex items-center justify-between gap-2 px-2 mb-7">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg text-[#0B0D10] flex items-center justify-center shrink-0"
              style={{ backgroundColor: themeConfig.accentColor }}
            >
              <Music2 size={18} strokeWidth={2.4} />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              Joytify
            </span>
          </div>
          <button
            type="button"
            onClick={() => setThemeModalOpen(true)}
            title="Ganti Tema & Latar Galeri"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-white/10 bg-[#151920] text-[#D1D5DB] hover:text-white hover:border-white/25 transition-colors"
            aria-label="Tema dan latar galeri"
          >
            <Palette size={16} />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Navigasi utama">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#171C24] text-[var(--joytify-accent)]'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Saved Playlists Shortcut */}
        <div className="mt-7 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-medium text-[#6B7280]">Playlist Anda</span>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="text-xs text-[var(--joytify-accent)] hover:underline"
            >
              + Impor
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {playlists.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[#6B7280] leading-relaxed">
                Impor playlist Spotify atau simpan lagu untuk akses cepat di sini.
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    if (pl.tracks.length > 0) engine.playTrack(pl.tracks[0], pl.tracks);
                  }}
                  className="w-full min-h-[40px] flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs text-[#D1D5DB] hover:bg-white/[0.04] hover:text-white transition-colors"
                >
                  <ListMusic size={14} className="text-[#6B7280] shrink-0" />
                  <span className="truncate flex-1">{pl.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Local Cache Meter & PWA Install Button */}
        <div className="pt-4 mt-4 border-t border-white/[0.07] space-y-3">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className="w-full text-left rounded-xl bg-[#13161B]/90 border border-white/[0.06] p-3 hover:border-white/15 transition-colors"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#D1D5DB] font-medium">
                <HardDrive size={13} style={{ color: themeConfig.accentColor }} />
                <span>Smart Cache</span>
              </span>
              <span className="font-mono tabular-nums text-[#9CA3AF]">
                {formatBytes(cacheSummary?.totalBytes || 0)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#0B0D10] overflow-hidden">
              <div
                className="h-full"
                style={{
                  backgroundColor: themeConfig.accentColor,
                  width: `${Math.min(
                    100,
                    Math.round(((cacheSummary?.totalBytes || 0) / cacheSettings.maxCacheBytes) * 100)
                  )}%`,
                }}
              />
            </div>
          </button>

          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 min-w-0 lg:pl-64 flex flex-col">
        {/* Top Bar (Non-sticky on mobile to respect <=15% sticky height cap) */}
        <header className="px-4 sm:px-8 py-4 border-b border-white/[0.08] bg-[#0B0D10]/55 backdrop-blur-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div
              className="w-7 h-7 rounded-lg text-[#0B0D10] flex items-center justify-center shrink-0"
              style={{ backgroundColor: themeConfig.accentColor }}
            >
              <Music2 size={16} strokeWidth={2.4} />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              Joytify
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className="min-h-[40px] w-72 flex items-center gap-2.5 rounded-xl border border-white/[0.09] bg-[#13161B]/80 px-3.5 text-xs text-[#9CA3AF] hover:border-white/20 hover:text-[#E5E7EB] transition-colors"
            >
              <Search size={15} />
              <span>Cari lagu YouTube, SoundCloud, Audius...</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setThemeModalOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#151920]/90 px-3 py-2 text-xs font-medium text-[#E5E7EB] hover:border-white/25 transition-colors whitespace-nowrap shrink-0"
              aria-label="Ganti tema dengan gambar galeri"
            >
              <Palette size={15} style={{ color: themeConfig.accentColor }} />
              <span>Tema</span>
            </button>
            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="hidden lg:inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-[#0B0D10] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              style={{ backgroundColor: themeConfig.accentColor }}
            >
              <Download size={15} />
              <span>Impor Playlist</span>
            </button>
          </div>
        </header>

        <main className={`flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 ${bottomPaddingClass}`}>
          {activeTab === 'discover' && (
            <DiscoverView
              audiusTrending={audiusTrending}
              soundcloudTrending={soundcloudTrending}
              publicHits={publicHits}
              lofiSession={lofiSession}
              loading={trendingLoading}
              error={trendingError}
              onRetry={() => void loadTrending()}
              onExploreQuery={handleExploreQuery}
              onOpenImport={() => setActiveTab('import')}
              currentTrackId={engine.currentTrack?.id}
              isPlaying={engine.isPlaying}
              cachedTrackIds={cachedTrackIds}
              cachingProgress={engine.cachingProgress}
              onPlayTrack={engine.playTrack}
              onAddToQueue={handleAddToQueue}
              onSaveTrackToPlaylist={(track) => setTrackForPlaylist(track)}
              onManualCache={(track) => void handleManualCache(track)}
            />
          )}

          {activeTab === 'search' && (
            <SearchView
              initialQuery={searchInitQuery}
              currentTrackId={engine.currentTrack?.id}
              isPlaying={engine.isPlaying}
              cachedTrackIds={cachedTrackIds}
              cachingProgress={engine.cachingProgress}
              onPlayTrack={engine.playTrack}
              onAddToQueue={handleAddToQueue}
              onSaveTrackToPlaylist={(track) => setTrackForPlaylist(track)}
              onManualCache={(track) => void handleManualCache(track)}
            />
          )}

          {activeTab === 'import' && (
            <ImportView
              onPlayPlaylist={(tracks) => {
                if (tracks.length > 0) engine.playTrack(tracks[0], tracks);
              }}
              onPlaySingle={engine.playTrack}
              onSavePlaylist={handleSavePlaylist}
            />
          )}

          {activeTab === 'library' && (
            <LibraryCacheView
              summary={cacheSummary}
              settings={cacheSettings}
              playlists={playlists}
              currentTrackId={engine.currentTrack?.id}
              onUpdateSettings={async (next) => {
                await saveCacheSettings(next);
                setCacheSettings(next);
                showToast('Pengaturan Smart Cache diperbarui.');
              }}
              onRemoveCachedTrack={async (id) => {
                await removeCachedTrack(id);
                await refreshCacheAndLibrary();
                showToast('Cache lagu dihapus.');
              }}
              onClearAllCache={async () => {
                await clearAllAudioCache();
                await refreshCacheAndLibrary();
                showToast('Seluruh cache lokal telah dibersihkan.');
              }}
              onPlayTrack={engine.playTrack}
              onPlayPlaylist={(pl) => {
                if (pl.tracks.length > 0) engine.playTrack(pl.tracks[0], pl.tracks);
              }}
              onDeletePlaylist={async (id) => {
                await deletePlaylistLocal(id);
                await refreshCacheAndLibrary();
                showToast('Playlist dihapus.');
              }}
            />
          )}
        </main>
      </div>

      {/* Persistent Audio Player Bar */}
      <PlayerBar
        currentTrack={engine.currentTrack}
        queue={engine.queue}
        isPlaying={engine.isPlaying}
        isBuffering={engine.isBuffering}
        currentTime={engine.currentTime}
        duration={engine.duration}
        volume={engine.volume}
        playbackRate={engine.playbackRate}
        shuffle={engine.shuffle}
        repeat={engine.repeat}
        playingFromCache={engine.playingFromCache}
        isCurrentCached={
          engine.currentTrack ? cachedTrackIds.has(engine.currentTrack.id) : false
        }
        cachingProgress={
          engine.currentTrack ? engine.cachingProgress[engine.currentTrack.id] : undefined
        }
        playerError={engine.playerError}
        onTogglePlay={engine.togglePlay}
        onSeek={engine.seekTo}
        onNext={engine.nextTrack}
        onPrev={engine.prevTrack}
        onVolumeChange={engine.setVolume}
        onPlaybackRateChange={engine.setPlaybackRate}
        onToggleShuffle={() => engine.setShuffle(!engine.shuffle)}
        onCycleRepeat={handleCycleRepeat}
        onPlayFromQueue={(track) => engine.playTrack(track)}
        onRemoveFromQueue={engine.removeFromQueue}
        onManualCache={(track) => void handleManualCache(track)}
      />

      {/* Mobile Fixed Bottom Navigation Bar (60px height) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-[#0E1115]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-4 items-center"
        aria-label="Navigasi seluler"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? 'text-[var(--joytify-accent)]' : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-[76px]">
                {item.id === 'library' ? 'Cache' : item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Offline Connectivity Banner */}
      {!isOnline && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#1B160C] px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg">
          <WifiOff size={15} className="text-amber-400" />
          <span>Mode Offline · Hanya lagu di Cache Lokal yang dapat diputar</span>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-32 lg:bottom-24 right-4 z-50 rounded-xl border border-white/10 bg-[#171C24] px-4 py-2.5 text-xs font-medium text-[#F4F5F7] shadow-xl"
        >
          {toastMessage}
        </div>
      )}

      {/* Custom Gallery Theme Modal */}
      <ThemeModal
        open={themeModalOpen}
        config={themeConfig}
        onClose={() => setThemeModalOpen(false)}
        onChange={handleThemeChange}
      />

      {/* Save Track to Playlist Modal */}
      {trackForPlaylist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-pl-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13161B] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 id="save-pl-title" className="text-base font-semibold text-[#F4F5F7]">
                Simpan ke Playlist
              </h3>
              <button
                type="button"
                onClick={() => setTrackForPlaylist(null)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white"
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#9CA3AF] truncate">
              Lagu: <span className="text-[#F4F5F7]">{trackForPlaylist.title}</span>
            </p>

            {playlists.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => void handleAddTrackToExistingPlaylist(pl, trackForPlaylist)}
                    className="w-full min-h-[44px] flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0B0D10] px-3.5 py-2 text-left text-sm text-[#F4F5F7] hover:border-[var(--joytify-accent)]/50 transition-colors"
                  >
                    <span className="truncate">{pl.name}</span>
                    <span className="font-mono text-xs tabular-nums text-[#9CA3AF] shrink-0">
                      {pl.tracks.length} lagu
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={handleCreatePlaylistWithTrack}
              className="pt-2 border-t border-white/[0.07] flex gap-2"
            >
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nama playlist baru..."
                className="flex-1 min-h-[44px] rounded-xl border border-white/10 bg-[#0B0D10] px-3.5 text-sm text-[#F4F5F7] placeholder:text-[#6B7280] focus:border-[var(--joytify-accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-[#0B0D10] hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: themeConfig.accentColor }}
              >
                <Plus size={15} />
                <span>Buat</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
