import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export const devicesModule: AnalyticsModule = {
  id: "devices",
  title: "Devices",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const pvWhere = `${sql} AND event_type IN ('page_view','route_change')`;

    const deviceClass = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT device_class AS v, COUNT(*) AS n FROM events WHERE ${pvWhere}
       GROUP BY v ORDER BY n DESC`,
      params
    );

    const browsers = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT browser_family AS v, COUNT(*) AS n FROM events WHERE ${pvWhere}
       GROUP BY v ORDER BY n DESC LIMIT 20`,
      params
    );

    const os = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT os_family AS v, COUNT(*) AS n FROM events WHERE ${pvWhere}
       GROUP BY v ORDER BY n DESC LIMIT 20`,
      params
    );

    const viewports = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(properties, '$.viewport')) AS v, COUNT(*) AS n
       FROM events WHERE ${pvWhere} AND JSON_EXTRACT(properties, '$.viewport') IS NOT NULL
       GROUP BY v ORDER BY n DESC LIMIT 20`,
      params
    );

    const languages = await query<{ v: string | null; n: number }>(
      ctx.pool,
      `SELECT language AS v, COUNT(*) AS n FROM events
       WHERE ${pvWhere} AND language IS NOT NULL
       GROUP BY v ORDER BY n DESC LIMIT 20`,
      params
    );

    const toTable = (label: string, rows: Array<{ v: string | null; n: number }>) => ({
      columns: [label, "Page views"],
      rows: rows.map((r) => [r.v ?? "unknown", Number(r.n)] as (string | number)[])
    });

    return {
      tables: {
        deviceClasses: toTable("Device class", deviceClass),
        browsers: toTable("Browser", browsers),
        operatingSystems: toTable("OS", os),
        viewports: toTable("Viewport", viewports),
        languages: toTable("Language", languages)
      }
    };
  }
};
