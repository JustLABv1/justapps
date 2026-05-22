import { getApiUrl } from './apiUrl';

const API_URL = getApiUrl();

async function resolveTokenFromSessionCookie(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { accessToken?: string };
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken.trim() : '';
    if (!accessToken) {
      return null;
    }

    localStorage.setItem('token', accessToken);
    window.dispatchEvent(new Event('auth:storage-change'));
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * Upload a file to the backend. Returns the public path of the uploaded asset.
 * Use for multipart/form-data uploads (e.g. logos).
 */
export async function uploadFile(endpoint: string, file: File): Promise<string> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${cleanEndpoint}`;
  let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    token = await resolveTokenFromSessionCookie();
  }

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload fehlgeschlagen: ${res.statusText}`);
  }

  const data = await res.json();
  return data.url;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // Ensure we don't have double slashes if endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${cleanEndpoint}`;

  let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    token = await resolveTokenFromSessionCookie();
  }
  const headers = new Headers(options.headers);
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const hadAuthorization = headers.has('Authorization');

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && hadAuthorization) {
       if (typeof window !== 'undefined') {
         localStorage.removeItem('token');
         localStorage.removeItem('user');
         window.dispatchEvent(new Event('auth:unauthorized'));
       }
    }

    return response;
  } catch (err) {
    if (typeof window === 'undefined') {
      console.error(`Fetch error in SSR for ${url}:`, err);
    }
    throw err;
  }
}
