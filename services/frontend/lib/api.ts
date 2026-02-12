const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
     if (typeof window !== 'undefined') {
       localStorage.removeItem('token');
       localStorage.removeItem('user');
       // Dispatch a custom event to notify the application that the session has expired
       window.dispatchEvent(new Event('auth:unauthorized'));
     }
  }

  return response;
}
