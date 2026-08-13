import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const engagementModule: AnalyticsModule = {
  id: "engagement",
  title: "Engagement",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);

    const time = await query<{ avg_ms: number | null; samples: number }>(
      ctx.pool,
      `SELECT AVG(duration_ms) AS avg_ms, COUNT(*) AS samples
       FROM events WHERE ${sql} AND event_type = 'engagement' AND duration_ms IS NOT NULL`,
      params
    );

    const scroll = await query<{ depth: number; n: number }>(
      ctx.pool,
      `SELECT numeric_value AS depth, COUNT(*) AS n FROM events
       WHERE ${sql} AND event_type = 'scroll_depth' AND numeric_value IS NOT NULL
       GROUP BY numeric_value ORDER BY depth`,
      params
    );

    const outbound = await query<{ target: string; n: number }>(
      ctx.pool,
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(properties, '$.target_host')) AS target, COUNT(*) AS n
       FROM events WHERE ${sql} AND event_type = 'outbound_link'
       GROUP BY target ORDER BY n DESC LIMIT 50`,
      params
    );

    const downloads = await query<{ file: string; n: number }>(
      ctx.pool,
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(properties, '$.file')) AS file, COUNT(*) AS n
       FROM events WHERE ${sql} AND event_type = 'file_download'
       GROUP BY file ORDER BY n DESC LIMIT 50`,
      params
    );

    const row = time[0];
    return {
      kpis: {
        avgEngagementMs: row && Number(row.samples) > 0 ? Math.round(Number(row.avg_ms)) : null,
        engagementSamples: row ? Number(row.samples) : 0
      },
      tables: {
        scrollDepth: {
          columns: ["Depth (%)", "Count"],
          rows: scroll.map((r) => [Number(r.depth), Number(r.n)])
        },
        outboundLinks: {
          columns: ["Target host", "Clicks"],
          rows: outbound.map((r) => [r.target, Number(r.n)])
        },
        downloads: {
          columns: ["File", "Downloads"],
          rows: downloads.map((r) => [r.file, Number(r.n)])
        }
      }
    };
  }
};
