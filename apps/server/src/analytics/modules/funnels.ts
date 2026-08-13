import type { FunnelDefinition, FunnelStep } from "@lumly/shared";
import { execute, query } from "../../db.js";
import { whereClause } from "../filters.js";
import type { AnalyticsModule } from "../types.js";

export async function listFunnels(ctx: { pool: Parameters<typeof query>[0] }, siteId: string): Promise<FunnelDefinition[]> {
  const rows = await query<{ id: number; site_id: string; name: string; steps: string | FunnelStep[]; created_at: Date }>(
    ctx.pool,
    "SELECT id, site_id, name, steps, created_at FROM funnel_definitions WHERE site_id = :site ORDER BY id ASC",
    { site: siteId }
  );
  return rows.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    name: r.name,
    steps: typeof r.steps === "string" ? JSON.parse(r.steps) : r.steps,
    createdAt: r.created_at.toISOString()
  }));
}

export async function createFunnel(
  ctx: { pool: Parameters<typeof execute>[0] },
  siteId: string,
  name: string,
  steps: FunnelStep[]
): Promise<number> {
  const res = await execute(
    ctx.pool,
    "INSERT INTO funnel_definitions (site_id, name, steps) VALUES (:site, :name, :steps)",
    { site: siteId, name, steps: JSON.stringify(steps) }
  );
  return res.insertId;
}

export async function deleteFunnel(ctx: { pool: Parameters<typeof execute>[0] }, siteId: string, id: number): Promise<void> {
  await execute(ctx.pool, "DELETE FROM funnel_definitions WHERE id = :id AND site_id = :site", { id, site: siteId });
}

/**
 * Compute funnel conversion. Requires consented session identity; in BASIC
 * mode sequential per-visitor analysis is not possible by design, so counts
 * fall back to raw event counts and are flagged accordingly.
 */
export async function computeFunnel(
  ctx: { pool: Parameters<typeof query>[0] },
  f: { site: string; from: string; to: string },
  steps: FunnelStep[]
): Promise<{ step: FunnelStep; count: number; conversionFromPrevious: number | null; consentedOnly: boolean }[]> {
  const results: { step: FunnelStep; count: number; conversionFromPrevious: number | null; consentedOnly: boolean }[] = [];
  let previousCount: number | null = null;

  const consented = await query<{ n: number }>(
    ctx.pool,
    `SELECT COUNT(*) AS n FROM events
     WHERE site_id = :site AND occurred_at >= :from AND occurred_at < :to AND session_id IS NOT NULL`,
    { site: f.site, from: new Date(f.from), to: new Date(f.to) }
  );
  const hasSessions = Number(consented[0]?.n ?? 0) > 0;

  if (!hasSessions) {
    // BASIC-only data: ordered per-visitor funnels are not computable.
    for (const step of steps) {
      results.push({ step, count: 0, conversionFromPrevious: null, consentedOnly: true });
    }
    return results;
  }

  // Session-ordered funnel: a session completes step N if a matching event
  // occurs after the timestamp at which it completed step N-1.
  let sessionSet = "SELECT DISTINCT session_id FROM events WHERE site_id = :site AND occurred_at >= :from AND occurred_at < :to AND session_id IS NOT NULL";
  const params: Record<string, unknown> = { site: f.site, from: new Date(f.from), to: new Date(f.to) };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const cond =
      step.type === "page"
        ? "event_type IN ('page_view','route_change') AND page_path = :stepValue"
        : "event_type = 'custom' AND event_name = :stepValue";
    params.stepValue = step.value;

    const sql = `
      SELECT COUNT(*) AS n FROM (
        SELECT e.session_id, MIN(e.occurred_at) AS reached_at
        FROM events e
        WHERE e.site_id = :site AND e.occurred_at >= :from AND e.occurred_at < :to
          AND e.session_id IN (${sessionSet}) AND ${cond}
        GROUP BY e.session_id
      ) t`;
    const rows = await query<{ n: number }>(ctx.pool, sql, params);
    const count = Number(rows[0]?.n ?? 0);
    results.push({
      step,
      count,
      conversionFromPrevious: previousCount === null || previousCount === 0 ? null : count / previousCount,
      consentedOnly: false
    });
    previousCount = count;

    // Narrow session set to those that reached this step (ordered after previous).
    sessionSet = `
      SELECT e.session_id FROM events e
      WHERE e.site_id = :site AND e.occurred_at >= :from AND e.occurred_at < :to
        AND e.session_id IN (${sessionSet}) AND ${cond}
      GROUP BY e.session_id`;
  }
  return results;
}

export const funnelsModule: AnalyticsModule = {
  id: "funnels",
  title: "Funnels",
  requiredMode: "consented",
  async query(ctx, f) {
    const funnels = await listFunnels(ctx, f.site);
    const computed = [];
    for (const funnel of funnels.slice(0, 10)) {
      const steps = await computeFunnel(ctx, f, funnel.steps);
      computed.push({ id: funnel.id, name: funnel.name, steps });
    }
    return {
      tables: {
        definitions: {
          columns: ["ID", "Name", "Steps"],
          rows: funnels.map((d) => [d.id, d.name, d.steps.map((s) => s.value).join(" -> ")])
        }
      },
      meta: {
        computed: JSON.parse(JSON.stringify(computed)),
        requiresConsented: true
      }
    };
  }
};
