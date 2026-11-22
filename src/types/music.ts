export type TrackSource = 'youtube' | 'audius' | 'soundcloud';

export interface Track {
  id: string;
  source: TrackSource;
  sourceId: string; // YouTube videoId, Audius trackId, or SoundCloud trackId
  title: string;
  artist: string;
  duration: number; // seconds
  thumbnail: string;
  genre?: string;
  viewCount?: string;
  /** True when direct audio bytes can be streamed via <audio> and cached in IndexedDB */
  supportsBinaryCache: boolean;
  /** Optional external preview URL */
  previewUrl?: string;
  /** Optional SoundCloud permalink URL */
  permalinkUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  origin: 'curated' | 'spotify-import' | 'youtube-import' | 'text-import' | 'custom';
  originUrl?: string;
  tracks: Track[];
  createdAt: number;
}

export interface ImportedTrackMatch {
  queryTitle: string;
  queryArtist: string;
  originalDurationSec: number;
  status: 'matched' | 'unmatched';
  matchedTrack: Track | null;
  alternatives: Track[];
}

export interface PlaylistImportResponse {
  playlistName: string;
  coverUrl: string;
  origin: 'spotify-import' | 'youtube-import' | 'text-import';
  originUrl?: string;
  totalFound: number;
  matchedCount: number;
  items: ImportedTrackMatch[];
}

export interface CachedTrackEntry {
  trackId: string;
  track: Track;
  playCount: number;
  lastPlayedAt: number;
  cachedAt: number;
  /** Size in bytes of stored audio + artwork blobs in IndexedDB */
  totalBytes: number;
  hasAudioBlob: boolean;
  hasArtworkBlob: boolean;
  lastPositionSec: number;
}

export interface CacheSettings {
  autoCacheThreshold: number; // e.g. 2 plays
  maxCacheBytes: number; // e.g. 150 MB
  autoCacheArtwork: boolean;
  audioOnlyLowBandwidth: boolean;
}

export interface GalleryWallpaper {
  id: string;
  name: string;
  dataUrl: string;
  extractedAccent: string;
  createdAt: number;
}

export interface CustomThemeConfig {
  activeWallpaperId: string | null; // null = default Obsidian dark studio
  accentColor: string;
  blurPx: number;
  dimOpacity: number; // 45..92
  wallpapers: GalleryWallpaper[];
}

export type RepeatMode = 'off' | 'all' | 'one';
export type NavTab = 'discover' | 'search' | 'import' | 'library';
