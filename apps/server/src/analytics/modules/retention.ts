import { query } from "../../db.js";
import type { AnalyticsModule } from "../types.js";

/**
 * Returning-visitor retention. Strictly consented-only: without persistent
 * recognition there is no mathematically valid retention metric, so BASIC
 * data yields nulls rather than approximations.
 */
export const retentionModule: AnalyticsModule = {
  id: "retention",
  title: "Retention",
  requiredMode: "consented",
  async query(ctx, f) {
    const params = { site: f.site, from: new Date(f.from), to: new Date(f.to) };

    const weekly = await query<{ week: string; visitors: number; returning_n: number }>(
      ctx.pool,
      `SELECT DATE_FORMAT(e.occurred_at, '%x-W%v') AS week,
              COUNT(DISTINCT e.visitor_id) AS visitors,
              COUNT(DISTINCT CASE WHEN prior.n > 0 THEN e.visitor_id END) AS returning_n
       FROM events e
       LEFT JOIN (
         SELECT DISTINCT visitor_id, 1 AS n FROM events
         WHERE site_id = :site AND occurred_at < :from AND visitor_id IS NOT NULL
       ) prior ON prior.visitor_id = e.visitor_id
       WHERE e.site_id = :site AND e.occurred_at >= :from AND e.occurred_at < :to
         AND e.visitor_id IS NOT NULL
       GROUP BY week ORDER BY week ASC`,
      params
    );

    const totals = await query<{ visitors: number; returning_n: number }>(
      ctx.pool,
      `SELECT COUNT(DISTINCT e.visitor_id) AS visitors,
              COUNT(DISTINCT CASE WHEN session_starts.n > 1 THEN e.visitor_id END) AS returning_n
       FROM events e
       LEFT JOIN (
         SELECT visitor_id, COUNT(DISTINCT session_id) AS n
         FROM events WHERE site_id = :site AND occurred_at >= :from AND occurred_at < :to
           AND visitor_id IS NOT NULL
         GROUP BY visitor_id
       ) session_starts ON session_starts.visitor_id = e.visitor_id
       WHERE e.site_id = :site AND e.occurred_at >= :from AND e.occurred_at < :to
         AND e.visitor_id IS NOT NULL`,
      params
    );

    const t = totals[0];
    const visitors = Number(t?.visitors ?? 0);

    return {
      kpis: {
        consentedVisitors: visitors > 0 ? visitors : null,
        returningVisitors: visitors > 0 ? Number(t?.returning_n ?? 0) : null,
        returnRate: visitors > 0 ? Number(t?.returning_n ?? 0) / visitors : null
      },
      series: weekly.map((w) => ({
        bucket: w.week,
        visitors: Number(w.visitors),
        returning: Number(w.returning_n)
      })),
      meta: { requiresConsented: true }
    };
  }
};
