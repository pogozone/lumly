import type { Site } from "@lumly/shared";
import type { Pool } from "../db.js";
import { execute, query } from "../db.js";

interface SiteRow {
  id: string;
  name: string;
  domain: string;
  allowed_origins: string | string[];
  timezone: string;
  retention_days: number;
  geo_enabled: number;
  default_tracking_mode: "basic" | "consented";
  query_allowlist: string | string[];
  created_at: Date;
}

function toSite(row: SiteRow): Site {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    allowedOrigins: typeof row.allowed_origins === "string" ? JSON.parse(row.allowed_origins) : row.allowed_origins,
    timezone: row.timezone,
    retentionDays: Number(row.retention_days),
    geoEnabled: Boolean(row.geo_enabled),
    defaultTrackingMode: row.default_tracking_mode,
    queryAllowlist: typeof row.query_allowlist === "string" ? JSON.parse(row.query_allowlist) : row.query_allowlist,
    createdAt: row.created_at.toISOString()
  };
}

/** Short-TTL in-memory cache so the collector avoids a DB roundtrip per event. */
export class SiteCache {
  private cache = new Map<string, { site: Site | null; expires: number }>();
  constructor(private pool: Pool, private ttlMs = 30_000) {}

  async get(id: string): Promise<Site | null> {
    const hit = this.cache.get(id);
    if (hit && hit.expires > Date.now()) return hit.site;
    const rows = await query<SiteRow>(
      this.pool,
      "SELECT * FROM sites WHERE id = :id",
      { id }
    );
    const site = rows[0] ? toSite(rows[0]) : null;
    this.cache.set(id, { site, expires: Date.now() + this.ttlMs });
    return site;
  }

  invalidate(id?: string): void {
    if (id) this.cache.delete(id);
    else this.cache.clear();
  }

  async list(): Promise<Site[]> {
    const rows = await query<SiteRow>(this.pool, "SELECT * FROM sites ORDER BY created_at ASC");
    return rows.map(toSite);
  }
}

export async function createSite(
  pool: Pool,
  input: {
    id: string;
    name: string;
    domain: string;
    allowedOrigins: string[];
    timezone?: string;
    retentionDays: number;
    geoEnabled?: boolean;
    queryAllowlist?: string[];
  }
): Promise<void> {
  await execute(
    pool,
    `INSERT INTO sites (id, name, domain, allowed_origins, timezone, retention_days, geo_enabled, query_allowlist)
     VALUES (:id, :name, :domain, :origins, :tz, :retention, :geo, :qa)`,
    {
      id: input.id,
      name: input.name,
      domain: input.domain,
      origins: JSON.stringify(input.allowedOrigins),
      tz: input.timezone ?? "UTC",
      retention: input.retentionDays,
      geo: input.geoEnabled ? 1 : 0,
      qa: JSON.stringify(input.queryAllowlist ?? [])
    }
  );
}

/** Origin check for the public collector. Exact origin match against allowlist. */
export function originAllowed(site: Site, origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (sendBeacon always sends Origin; be lenient when absent)
  return site.allowedOrigins.includes(origin);
}
