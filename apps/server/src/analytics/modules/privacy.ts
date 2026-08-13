import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

/** Transparency view: what is stored, in which mode, and retention state. */
export const privacyModule: AnalyticsModule = {
  id: "privacy",
  title: "Privacy",
  async query(ctx, f) {
    const { sql, params } = whereClause({ ...f, includeBots: true });
    const site = await ctx.sites.get(f.site);

    const split = await query<{ mode: string; page_views: number; events: number }>(
      ctx.pool,
      `SELECT tracking_mode AS mode,
              COUNT(CASE WHEN event_type IN ('page_view','route_change') THEN 1 END) AS page_views,
              COUNT(*) AS events
       FROM events WHERE ${sql} GROUP BY tracking_mode`,
      params
    );

    const lastRetention = await query<{ ran_at: Date; deleted_events: number }>(
      ctx.pool,
      "SELECT ran_at, deleted_events FROM retention_log WHERE site_id = :site ORDER BY ran_at DESC LIMIT 1",
      { site: f.site }
    );

    const basic = split.find((r) => r.mode === "basic");
    const consented = split.find((r) => r.mode === "consented");
    const totalPv = Number(basic?.page_views ?? 0) + Number(consented?.page_views ?? 0);

    return {
      kpis: {
        basicPageViews: Number(basic?.page_views ?? 0),
        consentedPageViews: Number(consented?.page_views ?? 0),
        consentRate: totalPv > 0 ? Number(consented?.page_views ?? 0) / totalPv : null
      },
      tables: {
        dataCategories: {
          columns: ["Category", "Basic", "Consented", "Retention"],
          rows: [
            ["Page views (path, title, host)", "yes", "yes", `${site?.retentionDays ?? "?"} days raw`],
            ["Referrer host (path: same-origin only)", "yes", "yes", `${site?.retentionDays ?? "?"} days raw`],
            ["Campaign parameters (allowlisted)", "yes", "yes", `${site?.retentionDays ?? "?"} days raw`],
            ["Coarse browser / OS / device class", "yes", "yes", `${site?.retentionDays ?? "?"} days raw`],
            ["visitor_id / session_id", "never", "after consent", "deleted on revocation; raw retention applies"],
            ["Engagement / scroll depth", "aggregate events", "yes", `${site?.retentionDays ?? "?"} days raw`],
            ["Performance metrics", "yes", "yes", `${site?.retentionDays ?? "?"} days raw`],
            ["Coarse country (if geo enabled)", site?.geoEnabled ? "yes" : "disabled", site?.geoEnabled ? "yes" : "disabled", `${site?.retentionDays ?? "?"} days raw`],
            ["Raw IP address", "never stored", "never stored", "not applicable"],
            ["Full User-Agent", "never stored", "never stored", "not applicable"],
            ["Hourly/daily rollups", "yes (no identifiers)", "yes (counts only)", "not time-limited"]
          ]
        }
      },
      meta: {
        geoEnabled: Boolean(site?.geoEnabled) && ctx.geo.enabled,
        retentionDays: site?.retentionDays ?? null,
        defaultTrackingMode: site?.defaultTrackingMode ?? "basic",
        lastRetentionRun: lastRetention[0]?.ran_at?.toISOString() ?? null,
        lastRetentionDeleted: Number(lastRetention[0]?.deleted_events ?? 0)
      }
    };
  }
};
