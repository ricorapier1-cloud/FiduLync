import 'server-only';

const DEFAULT_APP_URL = 'https://fidulync.com';

function parseHttpUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function getAppBaseUrl(fallback = DEFAULT_APP_URL): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured?.trim()) {
    const url = parseHttpUrl(configured);
    if (url) return url;
    console.error('NEXT_PUBLIC_APP_URL must be a valid HTTP(S) URL.');
  }

  return parseHttpUrl(fallback) ?? new URL(DEFAULT_APP_URL);
}

export function getSupabaseUrl(value = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  const url = parseHttpUrl(value);
  return url?.toString().replace(/\/$/, '') ?? null;
}
