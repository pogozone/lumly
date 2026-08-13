import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const acquisitionModule: AnalyticsModule = {
  id: "acquisition",
  title: "Acquisition",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const pvWhere = `${sql} AND event_type IN ('page_view','route_change')`;

    const referrers = await query<{ referrer_host: string; views: number }>(
      ctx.pool,
      `SELECT referrer_host, COUNT(*) AS views FROM events
       WHERE ${pvWhere} AND referrer_host IS NOT NULL
       GROUP BY referrer_host ORDER BY views DESC LIMIT 50`,
      params
    );

    const campaigns = await query<{
      source: string | null; medium: string | null; name: string | null; views: number;
    }>(
      ctx.pool,
      `SELECT campaign_source AS source, campaign_medium AS medium, campaign_name AS name, COUNT(*) AS views
       FROM events
       WHERE ${pvWhere} AND (campaign_source IS NOT NULL OR campaign_medium IS NOT NULL OR campaign_name IS NOT NULL)
       GROUP BY source, medium, name ORDER BY views DESC LIMIT 50`,
      params
    );

    const sources = await query<{ source: string; views: number }>(
      ctx.pool,
      `SELECT campaign_source AS source, COUNT(*) AS views FROM events
       WHERE ${pvWhere} AND campaign_source IS NOT NULL
       GROUP BY source ORDER BY views DESC LIMIT 50`,
      params
    );

    const mediums = await query<{ medium: string; views: number }>(
      ctx.pool,
      `SELECT campaign_medium AS medium, COUNT(*) AS views FROM events
       WHERE ${pvWhere} AND campaign_medium IS NOT NULL
       GROUP BY medium ORDER BY views DESC LIMIT 50`,
      params
    );

    return {
      tables: {
        referrers: {
          columns: ["Referrer", "Views"],
          rows: referrers.map((r) => [r.referrer_host, Number(r.views)])
        },
        sources: {
          columns: ["Source", "Views"],
          rows: sources.map((r) => [r.source, Number(r.views)])
        },
        mediums: {
          columns: ["Medium", "Views"],
          rows: mediums.map((r) => [r.medium, Number(r.views)])
        },
        campaigns: {
          columns: ["Source", "Medium", "Campaign", "Views"],
          rows: campaigns.map((r) => [r.source, r.medium, r.name, Number(r.views)])
        }
      }
    };
  }
};
