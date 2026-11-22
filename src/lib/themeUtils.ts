import type { CustomThemeConfig, GalleryWallpaper } from '../types/music';

export const DEFAULT_THEME_CONFIG: CustomThemeConfig = {
  activeWallpaperId: null,
  accentColor: '#1ED760',
  blurPx: 8,
  dimOpacity: 74,
  wallpapers: [],
};

export const THEME_ACCENT_SWATCHES = [
  { name: 'Mint Emerald', hex: '#1ED760' },
  { name: 'Amber Hangat', hex: '#F59E0B' },
  { name: 'Biru Langit', hex: '#38BDF8' },
  { name: 'Mawar Koral', hex: '#FB7185' },
  { name: 'Violet Studio', hex: '#A78BFA' },
  { name: 'Gading Klasik', hex: '#E5E7EB' },
];

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Resizes a gallery image on an offscreen canvas (max 1600px) so it persists
 * smoothly in IndexedDB and extracts a readable vibrant accent color.
 */
export function processGalleryImage(file: File): Promise<GalleryWallpaper> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Pilih berkas gambar yang valid dari galeri Anda.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca gambar dari galeri.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung oleh peramban.'));
      img.onload = () => {
        const maxDim = 1600;
        let w = img.naturalWidth || 1280;
        let h = img.naturalHeight || 720;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Kanvas gambar tidak tersedia.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);

        // Sample a downscaled grid to extract a bright, readable accent color
        let extractedAccent = '#1ED760';
        try {
          const sampleCanvas = document.createElement('canvas');
          sampleCanvas.width = 24;
          sampleCanvas.height = 24;
          const sCtx = sampleCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(img, 0, 0, 24, 24);
            const pixels = sCtx.getImageData(0, 0, 24, 24).data;
            let bestScore = -1;
            let bestRgb: [number, number, number] = [30, 215, 96];

            for (let i = 0; i < pixels.length; i += 4) {
              const r = pixels[i];
              const g = pixels[i + 1];
              const b = pixels[i + 2];
              const max = Math.max(r, g, b);
              const min = Math.min(r, g, b);
              const sat = max === 0 ? 0 : (max - min) / max;
              const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              // Prefer saturated mid-bright hues that remain legible on dark scrims
              const score = sat * 2.2 - Math.abs(lum - 0.62);
              if (lum > 0.32 && lum < 0.88 && score > bestScore) {
                bestScore = score;
                bestRgb = [r, g, b];
              }
            }
            if (bestScore > 0.15) {
              // Lift brightness slightly for dark-surface contrast
              const [r, g, b] = bestRgb;
              extractedAccent = rgbToHex(
                Math.min(255, r * 1.12 + 18),
                Math.min(255, g * 1.12 + 18),
                Math.min(255, b * 1.12 + 18)
              );
            }
          }
        } catch {
          // Fallback to default Mint Emerald
        }

        const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'Foto Galeri';
        resolve({
          id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          dataUrl,
          extractedAccent,
          createdAt: Date.now(),
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
