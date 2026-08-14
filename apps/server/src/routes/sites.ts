import type { FastifyInstance, FastifyRequest } from "fastify";
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

/**
 * Convert an absolute HTTP(S) URL to its canonical origin.
 *
 * Examples:
 *   http://lumly.emaz.local/          -> http://lumly.emaz.local
 *   https://example.org/foo?bar=baz   -> https://example.org
 *   https://example.org:443           -> https://example.org
 *
 * Origins without an explicit protocol are rejected deliberately: choosing
 * http or https on behalf of the operator would silently broaden or change the
 * collector allowlist.
 */
function normalizeOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Return the public origin through which the dashboard request reached Lumly.
 *
 * This matters behind `platform`/Apache: the Node process listens on an
 * internal address such as http://127.0.0.1:3000 while the browser uses
 * http://lumly.emaz.local. Fastify runs with trustProxy=true, so `protocol`
 * honours the proxy headers and ProxyPreserveHost keeps the public Host.
 */
function publicRequestOrigin(request: FastifyRequest, fallback: string): string {
  const host = request.headers.host;

  if (host) {
    try {
      const origin = new URL(`${request.protocol}://${host}`).origin;
      if (origin !== "null") return origin;
    } catch {
      // Fall through to the configured origin.
    }
  }

  try {
    return new URL(fallback).origin;
  } catch {
    return fallback;
  }
}

export function registerSiteRoutes(app: FastifyInstance, ctx: AppContext): void {
  const auth = requireAuth(ctx);

  app.get("/api/v1/sites", { preHandler: auth }, async (request) => ({
    sites: await ctx.sites.list(),
    appOrigin: publicRequestOrigin(request, ctx.config.appOrigin)
  }));

  app.post("/api/v1/sites", { preHandler: auth }, async (request, reply) => {
    const body = request.body as CreateSiteBody;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const domain = typeof body?.domain === "string" ? body.domain.trim().toLowerCase() : "";

    if (!name || name.length > 200) {
      return reply.code(400).send({
        error: "invalid_name",
        detail: "Der Name darf nicht leer und höchstens 200 Zeichen lang sein."
      });
    }

    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return reply.code(400).send({
        error: "invalid_domain",
        detail: "Die Domain muss als Hostname ohne Protokoll oder Pfad angegeben werden, z. B. shop.example.org."
      });
    }

    const rawOrigins = Array.isArray(body.allowedOrigins) ? body.allowedOrigins : [];
    if (rawOrigins.length === 0 || rawOrigins.length > 20) {
      return reply.code(400).send({
        error: "invalid_allowed_origins",
        detail: "Es muss mindestens eine und es dürfen höchstens 20 erlaubte Origins angegeben werden."
      });
    }

    const normalizedOrigins = rawOrigins.map(normalizeOrigin);
    if (normalizedOrigins.some((origin) => origin === null)) {
      return reply.code(400).send({
        error: "invalid_allowed_origins",
        detail: "Jede Origin muss eine gültige HTTP- oder HTTPS-Adresse mit Protokoll sein, z. B. http://app.example.local oder https://shop.example.org."
      });
    }

    const origins = [...new Set(normalizedOrigins as string[])];

    const retentionDays = Number(body.retentionDays ?? ctx.config.defaultRetentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      return reply.code(400).send({
        error: "invalid_retention_days",
        detail: "Retention muss als ganze Zahl zwischen 1 und 3650 Tagen angegeben werden."
      });
    }

    const timezone = typeof body.timezone === "string" && body.timezone.length <= 64 ? body.timezone : "UTC";
    const qa = Array.isArray(body.queryAllowlist)
      ? body.queryAllowlist
          .filter((q): q is string => typeof q === "string" && /^[a-z0-9_-]{1,40}$/i.test(q))
          .slice(0, 20)
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

    const origin = publicRequestOrigin(request, ctx.config.appOrigin);
    return {
      siteId: site.id,
      html: `<script defer src="${origin}/tracker.js" data-site="${site.id}" data-endpoint="${origin}/api/v1/collect"></script>`
    };
  });
}
