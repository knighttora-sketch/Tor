import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';
import {
  cacheTrackAudio,
  getCachedAudioUrl,
  recordTrackPlay,
  savePlaybackPosition,
} from '../lib/smartCache';
import type { RepeatMode, Track } from '../types/music';

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface SCWidgetInstance {
  load: (
    url: string,
    options?: {
      auto_play?: boolean;
      visual?: boolean;
      show_artwork?: boolean;
      callback?: () => void;
    }
  ) => void;
  play: () => void;
  pause: () => void;
  seekTo: (milliseconds: number) => void;
  setVolume: (volume: number) => void;
  getDuration: (cb: (ms: number) => void) => void;
  bind: (event: string, listener: (data?: { currentPosition?: number }) => void) => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          height: string;
          width: string;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
    SC?: {
      Widget: ((iframe: HTMLIFrameElement | string) => SCWidgetInstance) & {
        Events: {
          READY: string;
          PLAY: string;
          PAUSE: string;
          FINISH: string;
          PLAY_PROGRESS: string;
          ERROR: string;
        };
      };
    };
  }
}

export function useAudioEngine(onCacheUpdated?: () => void) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [playingFromCache, setPlayingFromCache] = useState(false);
  const [cachingProgress, setCachingProgress] = useState<Record<string, number>>({});
  const [playerError, setPlayerError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytReadyRef = useRef(false);
  const pendingYtIdRef = useRef<string | null>(null);

  const scWidgetRef = useRef<SCWidgetInstance | null>(null);
  const scReadyRef = useRef(false);
  const pendingScIdRef = useRef<string | null>(null);

  const currentTrackRef = useRef<Track | null>(null);
  const nextTrackFnRef = useRef<() => void>(() => {});
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const currentTrack = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  currentTrackRef.current = currentTrack;

  // Initialize hidden <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = volume;
    audioRef.current = audio;

    const handleTime = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleEnded = () => nextTrackFnRef.current();
    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setPlayerError('Stream audio tidak dapat diputar saat ini.');
    };

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load YouTube IFrame API dynamically for Audio-Only playback
  useEffect(() => {
    const initPlayer = () => {
      if (!window.YT?.Player || ytPlayerRef.current) return;
      const host = document.getElementById('joytify-yt-audio-host');
      if (!host) return;

      ytPlayerRef.current = new window.YT.Player('joytify-yt-audio-host', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
            ytPlayerRef.current?.setVolume(Math.round(volumeRef.current * 100));
            if (pendingYtIdRef.current) {
              const id = pendingYtIdRef.current;
              pendingYtIdRef.current = null;
              ytPlayerRef.current?.loadVideoById(id);
              ytPlayerRef.current?.playVideo();
            }
          },
          onStateChange: (e: { data: number }) => {
            if (currentTrackRef.current?.source !== 'youtube') return;
            if (e.data === 1) {
              setIsPlaying(true);
              setIsBuffering(false);
              setPlayerError(null);
              const d = ytPlayerRef.current?.getDuration() || 0;
              if (d > 0) setDuration(d);
            } else if (e.data === 2) {
              setIsPlaying(false);
            } else if (e.data === 3) {
              setIsBuffering(true);
            } else if (e.data === 0) {
              nextTrackFnRef.current();
            }
          },
          onError: () => {
            if (currentTrackRef.current?.source !== 'youtube') return;
            setIsBuffering(false);
            setIsPlaying(false);
            setPlayerError('Video publik tidak mengizinkan pemutaran embed audio-only.');
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.body.appendChild(tag);
      }
    }
  }, []);

  // Load SoundCloud Official HTML5 Widget API for Audio-Only playback
  useEffect(() => {
    const initSoundCloud = () => {
      if (!window.SC?.Widget || scWidgetRef.current) return;
      const iframe = document.getElementById('joytify-sc-audio-host') as HTMLIFrameElement | null;
      if (!iframe) return;

      const widget = window.SC.Widget(iframe);
      scWidgetRef.current = widget;
      const Events = window.SC.Widget.Events;

      widget.bind(Events.READY, () => {
        scReadyRef.current = true;
        widget.setVolume(Math.round(volumeRef.current * 100));
        if (pendingScIdRef.current) {
          const scId = pendingScIdRef.current;
          pendingScIdRef.current = null;
          widget.load(`https://api.soundcloud.com/tracks/${encodeURIComponent(scId)}`, {
            auto_play: true,
            visual: false,
            show_artwork: false,
            callback: () => {
              widget.setVolume(Math.round(volumeRef.current * 100));
              widget.getDuration((ms) => {
                if (ms > 0) setDuration(ms / 1000);
              });
              widget.play();
            },
          });
        }
      });

      widget.bind(Events.PLAY, () => {
        if (currentTrackRef.current?.source !== 'soundcloud') return;
        setIsPlaying(true);
        setIsBuffering(false);
        setPlayerError(null);
        widget.getDuration((ms) => {
          if (ms > 0) setDuration(ms / 1000);
        });
      });

      widget.bind(Events.PAUSE, () => {
        if (currentTrackRef.current?.source !== 'soundcloud') return;
        setIsPlaying(false);
      });

      widget.bind(Events.PLAY_PROGRESS, (data) => {
        if (currentTrackRef.current?.source !== 'soundcloud') return;
        if (typeof data?.currentPosition === 'number') {
          setCurrentTime(data.currentPosition / 1000);
        }
      });

      widget.bind(Events.FINISH, () => {
        if (currentTrackRef.current?.source !== 'soundcloud') return;
        nextTrackFnRef.current();
      });

      widget.bind(Events.ERROR, () => {
        if (currentTrackRef.current?.source !== 'soundcloud') return;
        setIsBuffering(false);
        setIsPlaying(false);
        setPlayerError('Track SoundCloud ini dibatasi untuk pemutaran embed eksternal.');
      });
    };

    if (window.SC?.Widget) {
      initSoundCloud();
    } else if (!document.querySelector('script[src="https://w.soundcloud.com/player/api.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.onload = initSoundCloud;
      document.body.appendChild(script);
    }
  }, []);

  // Poll YouTube current time smoothly while playing in Audio-Only mode
  useEffect(() => {
    if (!isPlaying || currentTrack?.source !== 'youtube') return;
    const timer = window.setInterval(() => {
      if (ytPlayerRef.current) {
        const t = ytPlayerRef.current.getCurrentTime?.() || 0;
        const d = ytPlayerRef.current.getDuration?.() || currentTrack.duration || 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [isPlaying, currentTrack]);

  // Periodically persist playback position to IndexedDB
  useEffect(() => {
    if (!currentTrack || currentTime < 3) return;
    const id = window.setTimeout(() => {
      savePlaybackPosition(currentTrack.id, currentTime);
    }, 2500);
    return () => window.clearTimeout(id);
  }, [currentTrack, currentTime]);

  const stopAllEngines = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (ytReadyRef.current && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // Ignore
      }
    }
    if (scReadyRef.current && scWidgetRef.current) {
      try {
        scWidgetRef.current.pause();
      } catch {
        // Ignore
      }
    }
  }, []);

  const loadAndPlayTrack = useCallback(
    async (track: Track) => {
      stopAllEngines();
      setPlayerError(null);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      setIsBuffering(true);
      setPlayingFromCache(false);

      // Update OS Media Session controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album:
            track.source === 'soundcloud'
              ? 'Joytify · SoundCloud'
              : track.source === 'youtube'
                ? 'Joytify Audio-Only'
                : 'Joytify Stream',
          artwork: track.thumbnail
            ? [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
            : [],
        });
      }

      // Record play & check Smart Caching threshold
      const playRecord = await recordTrackPlay(track);
      onCacheUpdated?.();

      if (track.source === 'audius' && audioRef.current) {
        const cached = await getCachedAudioUrl(track.id);
        if (cached) {
          objectUrlRef.current = cached.url;
          setPlayingFromCache(true);
          audioRef.current.src = cached.url;
          audioRef.current.playbackRate = playbackRate;
          await audioRef.current.play().catch(() => {});
          onCacheUpdated?.();
          return;
        }

        const streamSrc = apiUrl(`/api/audius-stream/${encodeURIComponent(track.sourceId)}`);
        audioRef.current.src = streamSrc;
        audioRef.current.playbackRate = playbackRate;
        await audioRef.current.play().catch(() => {});

        if (playRecord.shouldAutoCache) {
          cacheTrackAudio(track, (pct) => {
            setCachingProgress((prev) => ({ ...prev, [track.id]: pct }));
          })
            .then(() => {
              setCachingProgress((prev) => {
                const next = { ...prev };
                delete next[track.id];
                return next;
              });
              onCacheUpdated?.();
            })
            .catch(() => {
              setCachingProgress((prev) => {
                const next = { ...prev };
                delete next[track.id];
                return next;
              });
            });
        }
        return;
      }

      if (track.source === 'soundcloud') {
        if (scReadyRef.current && scWidgetRef.current) {
          scWidgetRef.current.load(
            `https://api.soundcloud.com/tracks/${encodeURIComponent(track.sourceId)}`,
            {
              auto_play: true,
              visual: false,
              show_artwork: false,
              callback: () => {
                scWidgetRef.current?.setVolume(Math.round(volumeRef.current * 100));
                scWidgetRef.current?.getDuration((ms) => {
                  if (ms > 0) setDuration(ms / 1000);
                });
                scWidgetRef.current?.play();
              },
            }
          );
        } else {
          pendingScIdRef.current = track.sourceId;
        }
        return;
      }

      // YouTube Public Audio-Only Mode
      if (track.source === 'youtube') {
        if (ytReadyRef.current && ytPlayerRef.current) {
          ytPlayerRef.current.loadVideoById(track.sourceId);
          ytPlayerRef.current.setPlaybackRate?.(playbackRate);
          ytPlayerRef.current.playVideo();
        } else {
          pendingYtIdRef.current = track.sourceId;
        }
      }
    },
    [onCacheUpdated, playbackRate, stopAllEngines]
  );

  const playTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      if (newQueue && newQueue.length > 0) {
        const idx = newQueue.findIndex((t) => t.id === track.id);
        setQueue(newQueue);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else {
        const existingIdx = queue.findIndex((t) => t.id === track.id);
        if (existingIdx >= 0) {
          setCurrentIndex(existingIdx);
        } else {
          setQueue((prev) => [track, ...prev]);
          setCurrentIndex(0);
        }
      }
      loadAndPlayTrack(track);
    },
    [loadAndPlayTrack, queue]
  );

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromQueue = useCallback(
    (trackId: string) => {
      setQueue((prev) => {
        const idx = prev.findIndex((t) => t.id === trackId);
        if (idx === -1) return prev;
        const next = prev.filter((t) => t.id !== trackId);
        if (idx < currentIndex) {
          setCurrentIndex((c) => Math.max(0, c - 1));
        } else if (idx === currentIndex) {
          if (next.length === 0) {
            stopAllEngines();
            setCurrentIndex(-1);
            setIsPlaying(false);
          } else {
            const newIdx = Math.min(idx, next.length - 1);
            setCurrentIndex(newIdx);
            loadAndPlayTrack(next[newIdx]);
          }
        }
        return next;
      });
    },
    [currentIndex, loadAndPlayTrack, stopAllEngines]
  );

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (currentTrack.source === 'audius' && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    } else if (currentTrack.source === 'youtube' && ytReadyRef.current && ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
    } else if (currentTrack.source === 'soundcloud' && scReadyRef.current && scWidgetRef.current) {
      if (isPlaying) {
        scWidgetRef.current.pause();
      } else {
        scWidgetRef.current.play();
      }
    }
  }, [currentTrack, isPlaying]);

  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(sec, duration || sec));
      setCurrentTime(clamped);
      if (currentTrack?.source === 'audius' && audioRef.current) {
        audioRef.current.currentTime = clamped;
      } else if (currentTrack?.source === 'youtube' && ytReadyRef.current && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(clamped, true);
      } else if (
        currentTrack?.source === 'soundcloud' &&
        scReadyRef.current &&
        scWidgetRef.current
      ) {
        scWidgetRef.current.seekTo(Math.round(clamped * 1000));
      }
    },
    [currentTrack, duration]
  );

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;
    if (repeat === 'one' && currentTrack) {
      seekTo(0);
      if (currentTrack.source === 'audius') audioRef.current?.play().catch(() => {});
      else if (currentTrack.source === 'soundcloud') scWidgetRef.current?.play();
      else ytPlayerRef.current?.playVideo();
      return;
    }
    let nextIdx = currentIndex + 1;
    if (shuffle && queue.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * queue.length);
      } while (nextIdx === currentIndex);
    } else if (nextIdx >= queue.length) {
      if (repeat === 'all') nextIdx = 0;
      else {
        setIsPlaying(false);
        return;
      }
    }
    setCurrentIndex(nextIdx);
    loadAndPlayTrack(queue[nextIdx]);
  }, [currentIndex, currentTrack, loadAndPlayTrack, queue, repeat, seekTo, shuffle]);

  nextTrackFnRef.current = nextTrack;

  const prevTrack = useCallback(() => {
    if (queue.length === 0) return;
    if (currentTime > 4) {
      seekTo(0);
      return;
    }
    const prevIdx = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIdx);
    loadAndPlayTrack(queue[prevIdx]);
  }, [currentIndex, currentTime, loadAndPlayTrack, queue, seekTo]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
  }, [nextTrack, prevTrack, togglePlay]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(Math.round(clamped * 100));
    }
    if (scReadyRef.current && scWidgetRef.current) {
      scWidgetRef.current.setVolume(Math.round(clamped * 100));
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.setPlaybackRate?.(rate);
    }
  }, []);

  const manualCacheTrack = useCallback(
    async (track: Track) => {
      if (!track.supportsBinaryCache) return;
      try {
        setCachingProgress((prev) => ({ ...prev, [track.id]: 1 }));
        await cacheTrackAudio(track, (pct) => {
          setCachingProgress((prev) => ({ ...prev, [track.id]: pct }));
        });
        onCacheUpdated?.();
      } finally {
        setCachingProgress((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      }
    },
    [onCacheUpdated]
  );

  return {
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    playbackRate,
    shuffle,
    repeat,
    playingFromCache,
    cachingProgress,
    playerError,
    playTrack,
    addToQueue,
    removeFromQueue,
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    setVolume,
    setPlaybackRate,
    setShuffle,
    setRepeat,
    manualCacheTrack,
  };
}
