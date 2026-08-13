import type { Pool } from "./db.js";
import type { SiteCache } from "./lib/sites.js";
import type { GeoLookup } from "./lib/geo.js";
import type { ServerConfig } from "./config.js";

export interface AppContext {
  config: ServerConfig;
  pool: Pool;
  sites: SiteCache;
  geo: GeoLookup;
}
