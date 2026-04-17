import { getApiUrl } from './apiUrl';

const ABSOLUTE_ASSET_RE = /^(https?:|data:|blob:)/i;
const IMAGE_FILE_RE = /\.(png|jpe?g|svg|webp|ico|avif|gif)(\?.*)?$/i;

export function isImageAssetSource(value?: string | null): boolean {
  const source = value?.trim();

  if (!source) {
    return false;
  }

  if (ABSOLUTE_ASSET_RE.test(source)) {
    return true;
  }

  if (source.startsWith('/uploads/') || source.startsWith('uploads/')) {
    return true;
  }

  if (source.startsWith('/api/')) {
    return true;
  }

  if (source.startsWith('/')) {
    return IMAGE_FILE_RE.test(source) || source.includes('/uploads/');
  }

  return IMAGE_FILE_RE.test(source);
}

export function resolveAssetUrl(value?: string | null): string | null {
  const source = value?.trim();

  if (!source) {
    return null;
  }

  if (ABSOLUTE_ASSET_RE.test(source) || source.startsWith('/api/')) {
    return source;
  }

  if (source.startsWith('/uploads/')) {
    return `${getApiUrl()}${source}`;
  }

  if (source.startsWith('uploads/')) {
    return `${getApiUrl()}/${source}`;
  }

  return source;
}

export function getImageAssetUrl(value?: string | null): string | null {
  if (!isImageAssetSource(value)) {
    return null;
  }

  return resolveAssetUrl(value);
}