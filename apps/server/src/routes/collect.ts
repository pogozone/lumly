import Ajv from "ajv";
import type { FastifyInstance, FastifyReply } from "fastify";
import { collectEnvelopeSchema, LIMITS, type CollectEnvelope, type IncomingEvent } from "@lumly/shared";
import { originAllowed } from "../lib/sites.js";
import { RateLimiter } from "../lib/rateLimit.js";
import { insertEvents, processEvents } from "../services/events.js";
import type { AppContext } from "../context.js";

const ajv = new Ajv({ allErrors: false, coerceTypes: false });
const validateEnvelope = ajv.compile(collectEnvelopeSchema);

// Public collector: 120 requests per minute per transient client key (memory only).
const collectLimiter = new RateLimiter(120, 60_000);

function addVaryOrigin(reply: FastifyReply): void {
  const current = reply.getHeader("Vary");
  if (!current) {
    reply.header("Vary", "Origin");
    return;
  }

  const values = String(current)
    .split(",")
    .map((value) => value.trim().toLowerCase());

  if (!values.includes("origin")) {
    reply.header("Vary", `${String(current)}, Origin`);
  }
}

/**
 * Collector responses may be read only by the exact browser origin that was
 * accepted for the site. Credentials are deliberately not supported.
 */
function setCollectorCorsHeaders(reply: FastifyReply, origin: string): void {
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
  reply.header("Access-Control-Max-Age", "600");
  addVaryOrigin(reply);
}

async function originExistsInAnySite(ctx: AppContext, origin: string): Promise<boolean> {
  const sites = await ctx.sites.list();
  return sites.some((site) => originAllowed(site, origin));
}

export function registerCollectRoute(app: FastifyInstance, ctx: AppContext): void {
  /**
   * Browser CORS preflight. OPTIONS cannot contain the later POST body and
   * therefore cannot tell us the site ID yet. We allow the preflight only when
   * the requesting origin occurs in at least one configured site. The actual
   * POST then performs the stricter site + origin check again.
   */
  app.options("/api/v1/collect", async (request, reply) => {
    const origin = request.headers.origin;

    if (!origin) {
      return reply.code(204).send();
    }

    if (!(await originExistsInAnySite(ctx, origin))) {
      return reply.code(403).send({ error: "origin_not_allowed" });
    }

    setCollectorCorsHeaders(reply, origin);
    return reply.code(204).send();
  });

  app.post(
    "/api/v1/collect",
    { bodyLimit: LIMITS.maxBodyBytes },
    async (request, reply) => {
      // Rate limiting is keyed transiently in memory; the IP is never persisted.
      if (!collectLimiter.allow(request.ip)) {
        return reply.code(429).send({ error: "rate_limited" });
      }

      const body = request.body as unknown;
      if (!validateEnvelope(body)) {
        return reply.code(400).send({ error: "invalid_envelope" });
      }
      const envelope = body as CollectEnvelope;

      const site = await ctx.sites.get(envelope.site);
      if (!site) {
        return reply.code(404).send({ error: "unknown_site" });
      }

      const origin = request.headers.origin;
      if (!originAllowed(site, origin)) {
        return reply.code(403).send({ error: "origin_not_allowed" });
      }

      // The preflight is only half of CORS: the actual POST response also needs
      // Access-Control-Allow-Origin or the browser will hide the successful
      // response and report another CORS failure.
      if (origin) {
        setCollectorCorsHeaders(reply, origin);
      }

      const { rows, rejected } = processEvents(
        site,
        envelope.events as IncomingEvent[],
        request.headers["user-agent"],
        request.ip,
        ctx.geo
      );
      const accepted = await insertEvents(
        ctx.pool,
        site,
        rows,
        request.headers["user-agent"],
        request.ip,
        ctx.geo
      );

      if (rejected.length > 0 && accepted === 0 && rows.length === 0) {
        return reply.code(400).send({ error: "all_events_rejected", rejected });
      }
      return reply.code(204).send();
    }
  );
}
