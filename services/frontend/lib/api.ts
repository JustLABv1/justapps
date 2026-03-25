export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const inlined = process.env.NEXT_PUBLIC_API_URL;
    // If we're in the browser and the inlined URL points to localhost but the page doesn't, 
    // it's a build-time leak or wrong local config. Use relative path instead.
    if (inlined && inlined.includes('localhost') && !window.location.hostname.includes('localhost')) {
      return '/api/v1';
    }
    return inlined || '/api/v1';
  }
  
  // SERVER SIDE
  // On the server, we should prefer internal networking.
  // In monolith mode (most common here), the backend is on localhost:8080.
  // In microservices, it would be justapps-backend:8082 or similar.
  // We use the internal URL if provided, otherwise fallback to localhost (monolith default).
  return process.env.INTERNAL_API_URL || 'http://localhost:8080/api/v1';
};

const API_URL = getApiUrl();

/**
 * Upload a file to the backend. Returns the full URL of the uploaded asset.
 * Use for multipart/form-data uploads (e.g. logos).
 */
export async function uploadFile(endpoint: string, file: File): Promise<string> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${cleanEndpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  // data.url is a path like "/uploads/<filename>"
  // Construct the full public URL using the same API base
  return `${API_URL}${data.url}`;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // Ensure we don't have double slashes if endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${cleanEndpoint}`;
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
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
