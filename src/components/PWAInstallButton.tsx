import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--joytify-accent)] px-4 py-2.5 text-sm font-semibold text-[#0B0D10] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--joytify-accent)]"
      >
        <Download size={16} />
        <span>{compact ? 'Pasang App' : 'Pasang Aplikasi (PWA)'}</span>
      </button>
    );
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#151920] px-4 py-2 text-xs font-medium text-[#E5E7EB] hover:bg-[#1C212B] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--joytify-accent)]"
      >
        <Smartphone size={15} style={{ color: 'var(--joytify-accent)' }} />
        <span>{isIOS ? 'Pasang di iPhone' : compact ? 'Pasang' : 'Cara Pasang di HP'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#13161B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-semibold text-[#F4F5F7]">
                Pasang Joytify ke HP Anda
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white hover:bg-white/5"
                aria-label="Tutup panduan"
              >
                <X size={18} />
              </button>
            </div>

            {isInIframe && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5 text-xs text-amber-100 leading-relaxed">
                <p>
                  Anda sedang membuka Joytify di dalam kotak pratinjau. Untuk memunculkan menu
                  instalasi Android/iOS, buka dulu di tab browser penuh:
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={typeof window !== 'undefined' ? window.location.origin : '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--joytify-accent)] px-3 py-1.5 font-semibold text-[#0B0D10]"
                  >
                    <ExternalLink size={14} />
                    <span>Buka Tab Penuh</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl()}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#0B0D10] px-3 py-1.5 font-medium text-white"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Link Disalin!' : 'Salin Link'}</span>
                  </button>
                </div>
              </div>
            )}

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-[#D1D5DB] leading-relaxed list-decimal list-inside">
                <li>
                  Buka link Joytify langsung di <strong>Safari</strong> iPhone/iPad.
                </li>
                <li>
                  Ketuk ikon <strong>Bagikan (kotak dengan panah ke atas)</strong> di bagian bawah.
                </li>
                <li>
                  Pilih <strong>Tambahkan ke Layar Utama</strong> lalu ketuk <strong>Tambah</strong>.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-[#D1D5DB] leading-relaxed list-decimal list-inside">
                <li>
                  Buka link Joytify langsung di aplikasi <strong>Google Chrome</strong> HP Anda (bukan di dalam preview editor).
                </li>
                <li>
                  Ketuk titik tiga (<strong>⋮</strong>) di pojok kanan atas Chrome.
                </li>
                <li>
                  Pilih <strong>Tambahkan ke layar utama</strong> → <strong>Instal</strong>. Joytify
                  akan terpasang seperti aplikasi HP biasa.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="min-h-[44px] w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
