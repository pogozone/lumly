import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const contentModule: AnalyticsModule = {
  id: "content",
  title: "Content",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const pvWhere = `${sql} AND event_type IN ('page_view','route_change')`;

    const topPages = await query<{ page_path: string; views: number; consented_views: number }>(
      ctx.pool,
      `SELECT page_path, COUNT(*) AS views,
              COUNT(CASE WHEN tracking_mode = 'consented' THEN 1 END) AS consented_views
       FROM events WHERE ${pvWhere}
       GROUP BY page_path ORDER BY views DESC LIMIT 50`,
      params
    );

    // Entry/exit pages require session identity: consented data only.
    const entryPages = await query<{ page_path: string; n: number }>(
      ctx.pool,
      `SELECT e.page_path, COUNT(*) AS n
       FROM events e
       JOIN (
         SELECT session_id, MIN(occurred_at) AS first_ts
         FROM events
         WHERE ${sql} AND event_type IN ('page_view','route_change') AND session_id IS NOT NULL
         GROUP BY session_id
       ) s ON s.session_id = e.session_id AND s.first_ts = e.occurred_at
       WHERE ${pvWhere} AND e.session_id IS NOT NULL
       GROUP BY e.page_path ORDER BY n DESC LIMIT 50`,
      params
    );

    const exitPages = await query<{ page_path: string; n: number }>(
      ctx.pool,
      `SELECT e.page_path, COUNT(*) AS n
       FROM events e
       JOIN (
         SELECT session_id, MAX(occurred_at) AS last_ts
         FROM events
         WHERE ${sql} AND event_type IN ('page_view','route_change') AND session_id IS NOT NULL
         GROUP BY session_id
       ) s ON s.session_id = e.session_id AND s.last_ts = e.occurred_at
       WHERE ${pvWhere} AND e.session_id IS NOT NULL
       GROUP BY e.page_path ORDER BY n DESC LIMIT 50`,
      params
    );

    const engagement = await query<{ page_path: string; avg_ms: number; samples: number }>(
      ctx.pool,
      `SELECT page_path, AVG(duration_ms) AS avg_ms, COUNT(*) AS samples
       FROM events WHERE ${sql} AND event_type = 'engagement' AND duration_ms IS NOT NULL
       GROUP BY page_path ORDER BY avg_ms DESC LIMIT 50`,
      params
    );

    const scroll = await query<{ page_path: string; depth: number; n: number }>(
      ctx.pool,
      `SELECT page_path, numeric_value AS depth, COUNT(*) AS n
       FROM events WHERE ${sql} AND event_type = 'scroll_depth' AND numeric_value IS NOT NULL
       GROUP BY page_path, numeric_value ORDER BY page_path, depth`,
      params
    );

    return {
      tables: {
        topPages: {
          columns: ["Page", "Views", "Consented views"],
          rows: topPages.map((r) => [r.page_path, Number(r.views), Number(r.consented_views)])
        },
        entryPages: {
          columns: ["Page", "Entries"],
          rows: entryPages.map((r) => [r.page_path, Number(r.n)])
        },
        exitPages: {
          columns: ["Page", "Exits"],
          rows: exitPages.map((r) => [r.page_path, Number(r.n)])
        },
        engagementPerPage: {
          columns: ["Page", "Avg engagement (s)", "Samples"],
          rows: engagement.map((r) => [r.page_path, Math.round(Number(r.avg_ms) / 100) / 10, Number(r.samples)])
        },
        scrollDepth: {
          columns: ["Page", "Depth (%)", "Count"],
          rows: scroll.map((r) => [r.page_path, Number(r.depth), Number(r.n)])
        }
      },
      meta: { consentedOnlyTables: ["entryPages", "exitPages"] }
    };
  }
};
