import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const geographyModule: AnalyticsModule = {
  id: "geography",
  title: "Geography",
  async query(ctx, f) {
    const site = await ctx.sites.get(f.site);
    const geoActive = Boolean(site?.geoEnabled) && ctx.geo.enabled;
    if (!geoActive) {
      return {
        tables: {} as Record<string, never>,
        meta: { available: false, reason: "geo_disabled" }
      };
    }
    const { sql, params } = whereClause(f);
    const pvWhere = `${sql} AND event_type IN ('page_view','route_change')`;

    const countries = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT country_code AS v, COUNT(*) AS n FROM events
       WHERE ${pvWhere} AND country_code IS NOT NULL
       GROUP BY v ORDER BY n DESC LIMIT 100`,
      params
    );

    const regions = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT CONCAT(country_code, '-', region_code) AS v, COUNT(*) AS n FROM events
       WHERE ${pvWhere} AND region_code IS NOT NULL
       GROUP BY v ORDER BY n DESC LIMIT 100`,
      params
    );

    return {
      tables: {
        countries: {
          columns: ["Country", "Page views"],
          rows: countries.map((r) => [r.v, Number(r.n)])
        },
        regions: {
          columns: ["Region", "Page views"],
          rows: regions.map((r) => [r.v, Number(r.n)])
        }
      },
      meta: { available: true }
    };
  }
};
