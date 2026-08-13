import { query } from "../../db.js";
import { bucketFormat, whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const trafficModule: AnalyticsModule = {
  id: "traffic",
  title: "Traffic",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const pvWhere = `${sql} AND event_type IN ('page_view','route_change')`;
    const fmt = bucketFormat(f);

    const series = await query<{ bucket: string; page_views: number; visitors: number | null; sessions: number | null }>(
      ctx.pool,
      `SELECT DATE_FORMAT(occurred_at, '${fmt}') AS bucket,
              COUNT(*) AS page_views,
              COUNT(DISTINCT visitor_id) AS visitors,
              COUNT(DISTINCT session_id) AS sessions
       FROM events WHERE ${pvWhere}
       GROUP BY bucket ORDER BY bucket ASC`,
      params
    );

    const byHour = await query<{ h: number; page_views: number }>(
      ctx.pool,
      `SELECT HOUR(occurred_at) AS h, COUNT(*) AS page_views
       FROM events WHERE ${pvWhere} GROUP BY h ORDER BY h ASC`,
      params
    );

    const byWeekday = await query<{ d: number; page_views: number }>(
      ctx.pool,
      `SELECT DAYOFWEEK(occurred_at) AS d, COUNT(*) AS page_views
       FROM events WHERE ${pvWhere} GROUP BY d ORDER BY d ASC`,
      params
    );

    const hasConsented = await query<{ n: number }>(
      ctx.pool,
      `SELECT COUNT(*) AS n FROM events WHERE ${pvWhere} AND tracking_mode = 'consented' LIMIT 1`,
      params
    );
    const consented = Number(hasConsented[0]?.n ?? 0) > 0;

    return {
      series: series.map((s) => ({
        bucket: String(s.bucket),
        pageViews: Number(s.page_views),
        visitors: consented ? Number(s.visitors ?? 0) : null,
        sessions: consented ? Number(s.sessions ?? 0) : null
      })),
      tables: {
        hourOfDay: {
          columns: ["Hour", "Page views"],
          rows: byHour.map((r) => [String(r.h), Number(r.page_views)])
        },
        weekday: {
          columns: ["Weekday", "Page views"],
          rows: byWeekday.map((r) => [String(r.d), Number(r.page_views)])
        }
      },
      meta: { consentedOnlyMetrics: consented ? [] : ["visitors", "sessions"] }
    };
  }
};
