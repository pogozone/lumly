/** API client. Session cookie is HttpOnly; CSRF token is kept in memory only. */

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.method && options.method !== "GET" && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  const res = await fetch(path, { ...options, headers, credentials: "same-origin" });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? "request_failed"), String(data.detail ?? ""));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" })
};

export interface SiteDto {
  id: string;
  name: string;
  domain: string;
  allowedOrigins: string[];
  timezone: string;
  retentionDays: number;
  geoEnabled: boolean;
  defaultTrackingMode: "basic" | "consented";
  queryAllowlist: string[];
  createdAt: string;
}

export interface TableData {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface ModuleResult {
  kpis?: Record<string, number | null>;
  series?: Array<Record<string, string | number | null>>;
  tables?: Record<string, TableData>;
  meta?: Record<string, unknown>;
}

export function moduleQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  return q.toString();
}

export function exportUrl(moduleId: string, table: string, params: Record<string, string | undefined>): string {
  return `/api/v1/analytics/${moduleId}/export?table=${encodeURIComponent(table)}&${moduleQuery(params)}`;
}
