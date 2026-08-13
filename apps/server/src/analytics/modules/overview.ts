import type { AppContext } from "../../context.js";
import { query } from "../../db.js";
import { bucketFormat, pctChange, previousRange, whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

interface KpiRow {
  page_views: number;
  total_events: number;
  basic_pv: number;
  consented_pv: number;
  visitors: number | null;
  sessions: number | null;
  engagement_ms: number | null;
  engagement_samples: number;
}

async function kpis(ctx: AppContext, where: string, params: Record<string, unknown>): Promise<KpiRow> {
  const rows = await query<KpiRow>(
    ctx.pool,
    `SELECT
       COUNT(CASE WHEN event_type IN ('page_view','route_change') THEN 1 END) AS page_views,
       COUNT(*) AS total_events,
       COUNT(CASE WHEN event_type IN ('page_view','route_change') AND tracking_mode = 'basic' THEN 1 END) AS basic_pv,
       COUNT(CASE WHEN event_type IN ('page_view','route_change') AND tracking_mode = 'consented' THEN 1 END) AS consented_pv,
       COUNT(DISTINCT visitor_id) AS visitors,
       COUNT(DISTINCT session_id) AS sessions,
       SUM(CASE WHEN event_type = 'engagement' THEN duration_ms ELSE NULL END) AS engagement_ms,
       COUNT(CASE WHEN event_type = 'engagement' AND duration_ms IS NOT NULL THEN 1 END) AS engagement_samples
     FROM events WHERE ${where}`,
    params
  );
  return rows[0]!;
}

export const overviewModule: AnalyticsModule = {
  id: "overview",
  title: "Overview",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const cur = await kpis(ctx, sql, params);

    const prev = previousRange(f);
    const prevParams = { ...params, from: prev.from, to: prev.to };
    const prv = await kpis(ctx, sql, prevParams);

    const hasConsented = Number(cur.consented_pv) > 0;
    const prevConsented = Number(prv.consented_pv) > 0;

    const fmt = bucketFormat(f);
    const series = await query<{
      bucket: string;
      page_views: number;
      events: number;
      visitors: number | null;
      sessions: number | null;
    }>(
      ctx.pool,
      `SELECT DATE_FORMAT(occurred_at, '${fmt}') AS bucket,
         COUNT(CASE WHEN event_type IN ('page_view','route_change') THEN 1 END) AS page_views,
         COUNT(*) AS events,
         COUNT(DISTINCT visitor_id) AS visitors,
         COUNT(DISTINCT session_id) AS sessions
       FROM events WHERE ${sql}
       GROUP BY bucket ORDER BY bucket ASC`,
      params
    );

    const topPages = await query<{ page_path: string; views: number }>(
      ctx.pool,
      `SELECT page_path, COUNT(*) AS views FROM events
       WHERE ${sql} AND event_type IN ('page_view','route_change')
       GROUP BY page_path ORDER BY views DESC LIMIT 10`,
      params
    );

    const kpiOut = (r: KpiRow, consented: boolean) => ({
      pageViews: Number(r.page_views),
      events: Number(r.total_events),
      basicPageViews: Number(r.basic_pv),
      consentedPageViews: Number(r.consented_pv),
      visitors: consented ? Number(r.visitors ?? 0) : null,
      sessions: consented ? Number(r.sessions ?? 0) : null,
      avgEngagementMs:
        Number(r.engagement_samples) > 0 ? Math.round(Number(r.engagement_ms) / Number(r.engagement_samples)) : null,
      consentRate:
        Number(r.page_views) > 0 ? Number(r.consented_pv) / Number(r.page_views) : null
    });

    const c = kpiOut(cur, hasConsented);
    const p = kpiOut(prv, prevConsented);

    return {
      kpis: { ...c },
      meta: {
        consentedOnlyMetrics: ["visitors", "sessions"],
        previous: p,
        change: {
          pageViews: pctChange(c.pageViews, p.pageViews),
          events: pctChange(c.events, p.events),
          visitors: c.visitors !== null && p.visitors !== null ? pctChange(c.visitors, p.visitors) : null,
          sessions: c.sessions !== null && p.sessions !== null ? pctChange(c.sessions, p.sessions) : null
        }
      },
      series: series.map((s) => ({
        bucket: String(s.bucket),
        pageViews: Number(s.page_views),
        events: Number(s.events),
        visitors: hasConsented ? Number(s.visitors ?? 0) : null,
        sessions: hasConsented ? Number(s.sessions ?? 0) : null
      })),
      tables: {
        topPages: {
          columns: ["Page", "Views"],
          rows: topPages.map((r) => [r.page_path, Number(r.views)])
        }
      }
    };
  }
};
