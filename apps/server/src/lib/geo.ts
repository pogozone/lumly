import type { ServerConfig } from "../config.js";

export interface GeoResult {
  countryCode: string | null;
  regionCode: string | null;
}

/**
 * Optional coarse GeoIP lookup. The raw IP is processed transiently and only
 * the coarse result is returned. Disabled by default; requires a locally
 * hosted MMDB file (no external requests are made).
 */
export class GeoLookup {
  private reader: { get(ip: string): unknown } | null = null;

  async init(config: ServerConfig): Promise<void> {
    if (!config.geoEnabled) return;
    if (!config.geoDbPath) {
      throw new Error("GEO_ENABLED=true requires GEO_DB_PATH pointing to a local MMDB file");
    }
    try {
      const mod = await import("mmdb-lib");
      const fs = await import("node:fs");
      const buf = fs.readFileSync(config.geoDbPath);
      this.reader = new mod.Reader(buf);
    } catch (err) {
      throw new Error(`Failed to load geo database: ${(err as Error).message}`);
    }
  }

  get enabled(): boolean {
    return this.reader !== null;
  }

  /** Transient lookup. The IP must not be persisted by callers. */
  lookup(ip: string): GeoResult {
    if (!this.reader) return { countryCode: null, regionCode: null };
    try {
      const res = this.reader.get(ip) as
        | { country?: { iso_code?: string }; registered_country?: { iso_code?: string } }
        | null;
      const code = res?.country?.iso_code ?? res?.registered_country?.iso_code ?? null;
      return {
        countryCode: code && /^[A-Z]{2}$/.test(code) ? code : null,
        regionCode: null // country-only granularity by default
      };
    } catch {
      return { countryCode: null, regionCode: null };
    }
  }
}
