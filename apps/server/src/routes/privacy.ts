import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { execute, query } from "../db.js";
import { runRetention } from "../services/retention.js";
import { requireAuth } from "./auth.js";

/**
 * Administrative privacy endpoints: data-subject deletion/export for
 * pseudonymous consented data and manual retention runs. All require auth.
 */
export function registerPrivacyRoutes(app: FastifyInstance, ctx: AppContext): void {
  const auth = requireAuth(ctx);

  app.delete("/api/v1/privacy/visitors/:siteId/:visitorId", { preHandler: auth }, async (request) => {
    const { siteId, visitorId } = request.params as { siteId: string; visitorId: string };
    const res = await execute(
      ctx.pool,
      "DELETE FROM events WHERE site_id = :site AND visitor_id = :vid",
      { site: siteId, vid: visitorId }
    );
    request.log.info({ requestId: request.id, route: "privacy.delete_visitor" }, "visitor events deleted");
    return { deleted: res.affectedRows };
  });

  /** Data-subject export of raw consented events for one visitor. */
  app.get("/api/v1/privacy/visitors/:siteId/:visitorId/export", { preHandler: auth }, async (request, reply) => {
    const { siteId, visitorId } = request.params as { siteId: string; visitorId: string };
    const rows = await query(
      ctx.pool,
      `SELECT event_id, occurred_at, event_type, event_name, tracking_mode,
              hostname, page_path, page_title, referrer_host, duration_ms, numeric_value, properties
       FROM events WHERE site_id = :site AND visitor_id = :vid
       ORDER BY occurred_at ASC LIMIT 50000`,
      { site: siteId, vid: visitorId }
    );
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="visitor-export.json"`);
    return { siteId, exportedEvents: rows.length, events: rows };
  });

  app.post("/api/v1/privacy/retention/run", { preHandler: auth }, async () => {
    await runRetention(ctx.pool, () => {});
    return { ok: true };
  });
}
