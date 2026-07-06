const rawApiUrl =
  import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "";

const normalizedApiUrl = rawApiUrl.trim().replace(/\/+$/, "");

// In development, default to the Vite proxy path. In production builds, use the local backend URL.
export const API_BASE_URL =
  normalizedApiUrl || (import.meta.env.DEV ? "/api" : "http://127.0.0.1:8000");

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (API_BASE_URL === "/api" && normalizedPath.startsWith("/api/")) {
    return normalizedPath;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}