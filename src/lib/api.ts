const DEFAULT_PUBLIC_API =
  import.meta.env.VITE_API_BASE_URL ||
  'https://ais-pre-cnxmx5jqmesgju6vftweij-656984162484.asia-southeast1.run.app';

const STORAGE_KEY = 'joytify_api_base_url';

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname, port } = window.location;
  // Capacitor Android serves bundled assets at https://localhost (no port) or capacitor://localhost
  return protocol === 'capacitor:' || (hostname === 'localhost' && port === '');
}

export function getApiBaseUrl(): string {
  if (!isCapacitorNative()) {
    return '';
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (saved && /^https?:\/\//i.test(saved)) {
      return saved.replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_PUBLIC_API.replace(/\/+$/, '');
}

export function setCustomApiBaseUrl(url: string): void {
  try {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else if (/^https?:\/\//i.test(trimmed)) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    // Ignore
  }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${normalizedPath}`;
}
