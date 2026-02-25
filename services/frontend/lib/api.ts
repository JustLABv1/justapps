const getApiUrl = () => {
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
  // In microservices, it would be app-store-backend:8082 or similar.
  // We use the internal URL if provided, otherwise fallback to localhost (monolith default).
  return process.env.INTERNAL_API_URL || 'http://localhost:8080/api/v1';
};

const API_URL = getApiUrl();

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
