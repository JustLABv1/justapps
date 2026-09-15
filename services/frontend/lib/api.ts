import { getApiUrl } from './apiUrl';

const API_URL = getApiUrl();

function reportBackendUnavailable(status?: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('backend:unavailable', { detail: { status } }));
}

/**
 * Upload a file to the backend. Returns the public path of the uploaded asset.
 * Use for multipart/form-data uploads (e.g. logos).
 */
export async function uploadFile(endpoint: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetchApi(endpoint, {
    method: 'POST',
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

  const headers = new Headers(options.headers);
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const hadAuthorization = headers.has('Authorization');

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status >= 500) {
      reportBackendUnavailable(response.status);
    }

    if (response.status === 401 && hadAuthorization) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }

    return response;
  } catch (err) {
    if (typeof window === 'undefined') {
      console.error(`Fetch error in SSR for ${url}:`, err);
    }
    reportBackendUnavailable();
    throw err;
  }
}
