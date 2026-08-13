import Ajv from "ajv";
import type { FastifyInstance } from "fastify";
import { collectEnvelopeSchema, LIMITS, type CollectEnvelope, type IncomingEvent } from "@lumly/shared";
import { originAllowed } from "../lib/sites.js";
import { RateLimiter } from "../lib/rateLimit.js";
import { insertEvents, processEvents } from "../services/events.js";
import type { AppContext } from "../context.js";

const ajv = new Ajv({ allErrors: false, coerceTypes: false });
const validateEnvelope = ajv.compile(collectEnvelopeSchema);

// Public collector: 120 requests per minute per transient client key (memory only).
const collectLimiter = new RateLimiter(120, 60_000);

export function registerCollectRoute(app: FastifyInstance, ctx: AppContext): void {
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
      if (!originAllowed(site, request.headers.origin)) {
        return reply.code(403).send({ error: "origin_not_allowed" });
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
