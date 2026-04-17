export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const inlined = process.env.NEXT_PUBLIC_API_URL;

    if (inlined && inlined.includes('localhost') && !window.location.hostname.includes('localhost')) {
      return '/api/v1';
    }

    return inlined || '/api/v1';
  }

  return process.env.INTERNAL_API_URL || 'http://localhost:8080/api/v1';
};