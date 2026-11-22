import React, { useRef, useState } from 'react';
import { Check, ImagePlus, Palette, RotateCcw, Trash2, X } from 'lucide-react';
import {
  DEFAULT_THEME_CONFIG,
  processGalleryImage,
  THEME_ACCENT_SWATCHES,
} from '../lib/themeUtils';
import type { CustomThemeConfig } from '../types/music';

interface ThemeModalProps {
  open: boolean;
  config: CustomThemeConfig;
  onClose: () => void;
  onChange: (next: CustomThemeConfig) => Promise<void>;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  open,
  config,
  onClose,
  onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const processed = [];
      for (const file of files.slice(0, 4)) {
        processed.push(await processGalleryImage(file));
      }
      const latest = processed[processed.length - 1];
      const nextWallpapers = [...processed, ...config.wallpapers].slice(0, 12);
      await onChange({
        ...config,
        wallpapers: nextWallpapers,
        activeWallpaperId: latest.id,
        accentColor: latest.extractedAccent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat gambar dari galeri.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectWallpaper = (id: string | null) => {
    if (!id) {
      void onChange({
        ...config,
        activeWallpaperId: null,
      });
      return;
    }
    const found = config.wallpapers.find((w) => w.id === id);
    void onChange({
      ...config,
      activeWallpaperId: id,
      accentColor: found?.extractedAccent || config.accentColor,
    });
  };

  const handleDeleteWallpaper = (id: string) => {
    const remaining = config.wallpapers.filter((w) => w.id !== id);
    const nextActive =
      config.activeWallpaperId === id ? remaining[0]?.id ?? null : config.activeWallpaperId;
    void onChange({
      ...config,
      wallpapers: remaining,
      activeWallpaperId: nextActive,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
    >
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-white/10 bg-[#13161B] p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[#0B0D10]"
              style={{ backgroundColor: config.accentColor }}
            >
              <Palette size={18} />
            </div>
            <div>
              <h2 id="theme-modal-title" className="text-base sm:text-lg font-semibold text-[#F4F5F7]">
                Tema &amp; Latar Galeri
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Pilih foto dari galeri HP/komputer untuk latar Joytify Anda
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/5"
            aria-label="Tutup pengaturan tema"
          >
            <X size={18} />
          </button>
        </div>

        {/* Upload From Device Gallery */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void handleFilesSelected(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="min-h-[48px] w-full flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-white/20 bg-[#0B0D10]/70 px-4 py-3 text-sm font-medium text-[#F4F5F7] hover:border-white/40 hover:bg-[#171C24] transition-colors"
          >
            <ImagePlus size={18} style={{ color: config.accentColor }} />
            <span>{uploading ? 'Memproses gambar galeri...' : 'Pilih Gambar dari Galeri Saya'}</span>
          </button>
          <p className="mt-1.5 text-[11px] text-[#6B7280]">
            Foto disimpan secara lokal di perangkat Anda dan warna aksen otomatis disesuaikan.
          </p>
          {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        </div>

        {/* Saved Gallery Wallpapers Switcher */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#D1D5DB]">
              Koleksi Latar Tersimpan ({config.wallpapers.length + 1})
            </p>
            {config.activeWallpaperId !== null && (
              <button
                type="button"
                onClick={() =>
                  void onChange({
                    ...DEFAULT_THEME_CONFIG,
                    wallpapers: config.wallpapers,
                  })
                }
                className="inline-flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-white"
              >
                <RotateCcw size={12} />
                <span>Reset Default</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Default Obsidian Studio Theme */}
            <button
              type="button"
              onClick={() => handleSelectWallpaper(null)}
              className={`relative aspect-[4/3] rounded-xl border overflow-hidden text-left p-2.5 flex flex-col justify-end transition-all ${
                config.activeWallpaperId === null
                  ? 'border-white ring-2 ring-white/30'
                  : 'border-white/10 hover:border-white/25'
              }`}
              style={{
                background: 'linear-gradient(135deg, #0B0D10 0%, #171C24 100%)',
              }}
            >
              <span className="text-[11px] font-semibold text-white">Studio Gelap</span>
              <span className="text-[10px] text-[#9CA3AF]">Default</span>
              {config.activeWallpaperId === null && (
                <span
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[#0B0D10]"
                  style={{ backgroundColor: config.accentColor }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>

            {config.wallpapers.map((wp) => {
              const active = config.activeWallpaperId === wp.id;
              return (
                <div
                  key={wp.id}
                  className={`group relative aspect-[4/3] rounded-xl border overflow-hidden ${
                    active ? 'border-white ring-2 ring-white/30' : 'border-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectWallpaper(wp.id)}
                    className="w-full h-full block text-left"
                    aria-label={`Aktifkan tema ${wp.name}`}
                  >
                    <img
                      src={wp.dataUrl}
                      alt={wp.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[11px] font-medium text-white truncate">
                      {wp.name}
                    </span>
                  </button>

                  {active && (
                    <span
                      className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[#0B0D10] pointer-events-none"
                      style={{ backgroundColor: config.accentColor }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteWallpaper(wp.id)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/65 text-white/80 hover:text-rose-400 flex items-center justify-center"
                    aria-label={`Hapus latar ${wp.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accent Color Swatches */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#D1D5DB]">Warna Aksen Antarmuka</p>
          <div className="flex flex-wrap items-center gap-2.5">
            {THEME_ACCENT_SWATCHES.map((sw) => {
              const selected = config.accentColor.toLowerCase() === sw.hex.toLowerCase();
              return (
                <button
                  key={sw.hex}
                  type="button"
                  onClick={() => void onChange({ ...config, accentColor: sw.hex })}
                  title={sw.name}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-transform ${
                    selected ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                  aria-label={`Pilih aksen ${sw.name}`}
                >
                  {selected && <Check size={15} className="text-[#0B0D10]" strokeWidth={3} />}
                </button>
              );
            })}

            <label
              className="min-h-[36px] inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-2.5 text-xs text-[#D1D5DB] cursor-pointer"
              title="Pilih warna kustom"
            >
              <input
                type="color"
                value={config.accentColor}
                onChange={(e) => void onChange({ ...config, accentColor: e.target.value })}
                className="w-5 h-5 rounded bg-transparent border-0 cursor-pointer"
                aria-label="Warna aksen kustom"
              />
              <span className="font-mono text-[11px]">{config.accentColor.toUpperCase()}</span>
            </label>
          </div>
        </div>

        {/* Scrim Dim & Blur Sliders when a gallery wallpaper is active */}
        {config.activeWallpaperId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.07]">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#D1D5DB]">Kepekatan Lapisan Gelap</span>
                <span className="font-mono tabular-nums text-[#9CA3AF]">{config.dimOpacity}%</span>
              </div>
              <input
                type="range"
                min={45}
                max={92}
                value={config.dimOpacity}
                onChange={(e) =>
                  void onChange({ ...config, dimOpacity: Number(e.target.value) })
                }
                className="joytify-range w-full"
                style={{
                  background: `linear-gradient(to right, ${config.accentColor} ${((config.dimOpacity - 45) / 47) * 100}%, rgba(255,255,255,0.14) ${((config.dimOpacity - 45) / 47) * 100}%)`,
                }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#D1D5DB]">Efek Blur Latar</span>
                <span className="font-mono tabular-nums text-[#9CA3AF]">{config.blurPx}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                value={config.blurPx}
                onChange={(e) => void onChange({ ...config, blurPx: Number(e.target.value) })}
                className="joytify-range w-full"
                style={{
                  background: `linear-gradient(to right, ${config.accentColor} ${(config.blurPx / 24) * 100}%, rgba(255,255,255,0.14) ${(config.blurPx / 24) * 100}%)`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
