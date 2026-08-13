import type { FastifyInstance } from "fastify";
import { randomId } from "@lumly/shared";
import type { AppContext } from "../context.js";
import { execute } from "../db.js";
import { createSite } from "../lib/sites.js";
import { requireAuth } from "./auth.js";

interface CreateSiteBody {
  name?: unknown;
  domain?: unknown;
  allowedOrigins?: unknown;
  timezone?: unknown;
  retentionDays?: unknown;
  geoEnabled?: unknown;
  queryAllowlist?: unknown;
}

function validOrigin(o: unknown): o is string {
  if (typeof o !== "string") return false;
  try {
    const u = new URL(o);
    return (u.protocol === "https:" || u.protocol === "http:") && u.origin === o;
  } catch {
    return false;
  }
}

export function registerSiteRoutes(app: FastifyInstance, ctx: AppContext): void {
  const auth = requireAuth(ctx);

  app.get("/api/v1/sites", { preHandler: auth }, async () => ({
    sites: await ctx.sites.list(),
    appOrigin: ctx.config.appOrigin
  }));

  app.post("/api/v1/sites", { preHandler: auth }, async (request, reply) => {
    const body = request.body as CreateSiteBody;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const domain = typeof body?.domain === "string" ? body.domain.trim().toLowerCase() : "";
    if (!name || name.length > 200) return reply.code(400).send({ error: "invalid_name" });
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return reply.code(400).send({ error: "invalid_domain" });

    const origins = Array.isArray(body.allowedOrigins) ? body.allowedOrigins : [];
    if (origins.length === 0 || origins.length > 20 || !origins.every(validOrigin)) {
      return reply.code(400).send({ error: "invalid_allowed_origins" });
    }
    const retentionDays = Number(body.retentionDays ?? ctx.config.defaultRetentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      return reply.code(400).send({ error: "invalid_retention_days" });
    }
    const timezone = typeof body.timezone === "string" && body.timezone.length <= 64 ? body.timezone : "UTC";
    const qa = Array.isArray(body.queryAllowlist)
      ? body.queryAllowlist.filter((q): q is string => typeof q === "string" && /^[a-z0-9_-]{1,40}$/i.test(q)).slice(0, 20)
      : [];

    const id = randomId().slice(0, 12);
    await createSite(ctx.pool, {
      id,
      name,
      domain,
      allowedOrigins: origins,
      timezone,
      retentionDays,
      geoEnabled: body.geoEnabled === true && ctx.config.geoEnabled,
      queryAllowlist: qa
    });
    ctx.sites.invalidate();
    return reply.code(201).send({ id });
  });

  app.delete("/api/v1/sites/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await execute(ctx.pool, "DELETE FROM sites WHERE id = :id", { id });
    ctx.sites.invalidate();
    return reply.code(204).send();
  });

  /** Integration snippet for a site. */
  app.get("/api/v1/sites/:id/snippet", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await ctx.sites.get(id);
    if (!site) return reply.code(404).send({ error: "unknown_site" });
    const origin = ctx.config.appOrigin;
    return {
      siteId: site.id,
      html: `<script defer src="${origin}/tracker.js" data-site="${site.id}" data-endpoint="${origin}/api/v1/collect"></script>`
    };
  });
}
