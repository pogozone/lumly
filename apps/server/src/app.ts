import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AppContext } from "./context.js";
import { registerCollectRoute } from "./routes/collect.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSiteRoutes } from "./routes/sites.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerPrivacyRoutes } from "./routes/privacy.js";
import { registerFunnelRoutes } from "./routes/funnels.js";
import { aggregateRecent } from "./services/aggregate.js";
import { runRetention } from "./services/retention.js";
import { pruneExpiredSessions } from "./services/auth.js";
import { query } from "./db.js";

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: ctx.config.logLevel,
      // Never log IPs, cookies, auth headers or request bodies.
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "remoteAddress", "ip", "ips"],
        remove: true
      }
    },
    disableRequestLogging: true,
    trustProxy: true
  });

  await app.register(cookie);

  // CORS is intentionally not enabled globally. The admin API is same-origin,
  // while the public collector implements a narrow, site-aware CORS policy in
  // routes/collect.ts.

  // Security headers for everything; strict CSP for the dashboard.
  app.addHook("onSend", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (!request.url.startsWith("/api/v1/collect")) {
      reply.header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
      );
    }
  });

  // Safe client-facing errors: no stack traces, no internals.
  app.setErrorHandler((err: import("fastify").FastifyError, request, reply) => {
    request.log.warn({ requestId: request.id, code: err.code ?? "error", status: err.statusCode }, "request failed");
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({
      error: status === 500 ? "internal_error" : (err.code ?? "request_error"),
      requestId: request.id
    });
  });

  const health = async () => {
    await query(ctx.pool, "SELECT 1 AS ok");
    return { status: "ok" };
  };
  app.get("/api/v1/health", health);
  app.get("/health", health); // platform/docker healthcheck alias

  registerCollectRoute(app, ctx);
  registerAuthRoutes(app, ctx);
  registerSiteRoutes(app, ctx);
  registerAnalyticsRoutes(app, ctx);
  registerPrivacyRoutes(app, ctx);
  registerFunnelRoutes(app, ctx);

  // Serve tracker.js
  const trackerFile = path.join(ctx.config.trackerDist, "tracker.js");
  if (existsSync(trackerFile)) {
    app.get("/tracker.js", async (_request, reply) => {
      const { readFile } = await import("node:fs/promises");
      reply.header("Cache-Control", "public, max-age=3600");
      reply.type("application/javascript; charset=utf-8");
      return reply.send(await readFile(trackerFile));
    });
  }

  // Serve dashboard SPA (production).
  if (existsSync(ctx.config.dashboardDist)) {
    await app.register(fastifyStatic, {
      root: ctx.config.dashboardDist,
      prefix: "/",
      index: ["index.html"]
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) {
        return reply.sendFile("index.html", ctx.config.dashboardDist);
      }
      return reply.code(404).send({ error: "not_found" });
    });
  }

  // Background jobs: aggregation (15 min), retention (hourly), session prune.
  const jobs: NodeJS.Timeout[] = [];
  if (ctx.config.env !== "test") {
    jobs.push(
      setInterval(async () => {
        try {
          const sites = await query<{ id: string }>(ctx.pool, "SELECT id FROM sites");
          for (const s of sites) await aggregateRecent(ctx.pool, s.id);
        } catch (err) {
          app.log.warn({ err: (err as Error).message }, "aggregation job failed");
        }
      }, 15 * 60 * 1000),
      setInterval(async () => {
        try {
          await runRetention(ctx.pool, (m) => app.log.info(m));
          await pruneExpiredSessions(ctx.pool);
        } catch (err) {
          app.log.warn({ err: (err as Error).message }, "retention job failed");
        }
      }, 60 * 60 * 1000)
    );
    jobs.forEach((j) => j.unref());
  }
  app.addHook("onClose", async () => jobs.forEach(clearInterval));

  return app;
}
