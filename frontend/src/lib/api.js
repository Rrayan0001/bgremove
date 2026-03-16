const DEFAULT_MAX_UPLOAD_SIZE_MB = 10;

function normalizeBaseUrl(value = '') {
  return value.trim().replace(/\/+$/, '');
}

function parseUploadLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_SIZE_MB;
  }
  return parsed;
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || '');
export const MAX_UPLOAD_SIZE_MB = parseUploadLimit(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB);
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
