import { ApiSuccess } from '@/types';

/** Used only when VITE_API_BASE_URL is missing or is not an absolute http(s) URL. */
const BACKEND_FALLBACK_ORIGIN = 'http://localhost:5000';

function normalize(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveApiOrigin(): string {
  const configured = normalize(import.meta.env.VITE_API_BASE_URL);
  if (isAbsoluteHttpUrl(configured)) return configured;

  const reason = configured
    ? `VITE_API_BASE_URL must be an absolute http(s) URL (received "${configured}")`
    : 'VITE_API_BASE_URL is not set';
  console.error(`[api] ${reason}. Requests will use ${BACKEND_FALLBACK_ORIGIN}.`);
  return BACKEND_FALLBACK_ORIGIN;
}

function resolveSocketOrigin(apiOrigin: string): string {
  const fromApi = apiOrigin.replace(/\/api\/?$/, '');
  const configured = normalize(import.meta.env.VITE_SOCKET_URL);
  if (!configured) return fromApi;
  if (isAbsoluteHttpUrl(configured)) return configured.replace(/\/api\/?$/, '');

  console.error(
    `[api] VITE_SOCKET_URL must be an absolute http(s) URL (received "${configured}"). Using ${fromApi}.`,
  );
  return fromApi;
}

const apiOrigin = resolveApiOrigin();

export const API_BASE_URL = apiOrigin.endsWith('/api') ? apiOrigin : `${apiOrigin}/api`;
export const SOCKET_URL = resolveSocketOrigin(apiOrigin);

const TOKEN_KEY = 'pulsecare.token';

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { message?: string; statusCode?: number };
    return new ApiError(body.message ?? 'Request failed', body.statusCode ?? response.status);
  } catch {
    return new ApiError('Request failed', response.status);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    throw await parseError(response);
  }
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
