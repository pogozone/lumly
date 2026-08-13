import { query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

const METRICS = ["ttfb_ms", "fcp_ms", "lcp_ms", "inp_ms", "dcl_ms", "load_ms"] as const;

function numExpr(metric: string): string {
  return `CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.${metric}')) AS DECIMAL(12,2))`;
}

export const performanceModule: AnalyticsModule = {
  id: "performance",
  title: "Performance",
  async query(ctx, f) {
    const { sql, params } = whereClause(f);
    const perfWhere = `${sql} AND event_type = 'performance'`;

    const selects = METRICS.map(
      (m) => `AVG(${numExpr(m)}) AS avg_${m}, COUNT(${numExpr(m)}) AS n_${m}`
    ).join(", ");
    const overall = await query<Record<string, number | null>>(
      ctx.pool,
      `SELECT ${selects}, AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.cls')) AS DECIMAL(10,4))) AS avg_cls,
              COUNT(JSON_EXTRACT(properties, '$.cls')) AS n_cls
       FROM events WHERE ${perfWhere}`,
      params
    );

    const byPage = await query<Record<string, string | number | null>>(
      ctx.pool,
      `SELECT page_path,
              AVG(${numExpr("lcp_ms")}) AS avg_lcp,
              AVG(${numExpr("inp_ms")}) AS avg_inp,
              AVG(${numExpr("ttfb_ms")}) AS avg_ttfb,
              COUNT(*) AS samples
       FROM events WHERE ${perfWhere}
       GROUP BY page_path ORDER BY samples DESC LIMIT 50`,
      params
    );

    const o = overall[0] ?? {};
    const kpi = (key: string): number | null => {
      const n = Number(o[`n_${key}`] ?? 0);
      return n > 0 ? Math.round(Number(o[`avg_${key}`])) : null;
    };

    return {
      kpis: {
        ttfbMs: kpi("ttfb_ms"),
        fcpMs: kpi("fcp_ms"),
        lcpMs: kpi("lcp_ms"),
        inpMs: kpi("inp_ms"),
        dclMs: kpi("dcl_ms"),
        loadMs: kpi("load_ms"),
        cls: Number(o.n_cls ?? 0) > 0 ? Math.round(Number(o.avg_cls) * 1000) / 1000 : null,
        samples: Number(o.n_lcp_ms ?? 0)
      },
      tables: {
        byPage: {
          columns: ["Page", "LCP (ms)", "INP (ms)", "TTFB (ms)", "Samples"],
          rows: byPage.map((r) => [
            String(r.page_path),
            r.avg_lcp !== null ? Math.round(Number(r.avg_lcp)) : null,
            r.avg_inp !== null ? Math.round(Number(r.avg_inp)) : null,
            r.avg_ttfb !== null ? Math.round(Number(r.avg_ttfb)) : null,
            Number(r.samples)
          ])
        }
      }
    };
  }
};
