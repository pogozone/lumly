import { query } from "../../db.js";
import { bucketFormat, whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const eventsModule: AnalyticsModule = {
  id: "events",
  title: "Events",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const customWhere = `${sql} AND event_type = 'custom' AND event_name IS NOT NULL`;
    const fmt = bucketFormat(f);

    const totals = await query<{ event_name: string; n: number }>(
      ctx.pool,
      `SELECT event_name, COUNT(*) AS n FROM events
       WHERE ${customWhere} GROUP BY event_name ORDER BY n DESC LIMIT 100`,
      params
    );

    const series = await query<{ bucket: string; event_name: string; n: number }>(
      ctx.pool,
      `SELECT DATE_FORMAT(occurred_at, '${fmt}') AS bucket, event_name, COUNT(*) AS n
       FROM events WHERE ${customWhere}
       GROUP BY bucket, event_name ORDER BY bucket ASC`,
      params
    );

    let propertyKeys: Array<{ k: string; n: number }> = [];
    if (f.eventName) {
      propertyKeys = await query<{ k: string; n: number }>(
        ctx.pool,
        `SELECT jt.k, COUNT(*) AS n
         FROM events,
              JSON_TABLE(JSON_KEYS(properties), '$[*]' COLUMNS (k VARCHAR(60) PATH '$')) jt
         WHERE ${customWhere}
         GROUP BY jt.k ORDER BY n DESC LIMIT 50`,
        params
      );
    }

    return {
      series: series.map((s) => ({ bucket: String(s.bucket), name: s.event_name, count: Number(s.n) })),
      tables: {
        totals: {
          columns: ["Event", "Count"],
          rows: totals.map((r) => [r.event_name, Number(r.n)])
        },
        propertyKeys: {
          columns: ["Property", "Occurrences"],
          rows: propertyKeys.map((r) => [r.k, Number(r.n)])
        }
      }
    };
  }
};
