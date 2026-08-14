import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "../context.js";
import { createUser, getSession, login, logout, pruneExpiredSessions, userCount } from "../services/auth.js";
import { RateLimiter } from "../lib/rateLimit.js";

const loginLimiter = new RateLimiter(10, 60_000);

const COOKIE_NAME = "lt_session";

declare module "fastify" {
  interface FastifyRequest {
    session?: import("../services/auth.js").SessionInfo;
  }
}

function sessionCookie(request: FastifyRequest) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    // Local deployments served over plain HTTP must not receive a Secure
    // cookie. Behind an HTTPS reverse proxy Fastify resolves request.protocol
    // from X-Forwarded-Proto because the app runs with trustProxy enabled.
    secure: request.protocol === "https"
  };
}

/** Auth guard for administrative endpoints. */
export function requireAuth(ctx: AppContext) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies[COOKIE_NAME];
    if (!sessionId) return reply.code(401).send({ error: "unauthenticated" });
    const session = await getSession(ctx.pool, sessionId);
    if (!session) return reply.code(401).send({ error: "unauthenticated" });
    // CSRF: state-changing requests must present the session's CSRF token.
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      const token = request.headers["x-csrf-token"];
      if (token !== session.csrfToken) {
        return reply.code(403).send({ error: "csrf_token_invalid" });
      }
    }
    request.session = session;
  };
}

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/v1/auth/login", async (request, reply) => {
    // Rate limited by transient client key; not persisted.
    if (!loginLimiter.allow(request.ip)) {
      return reply.code(429).send({ error: "rate_limited" });
    }
    const body = request.body as { email?: unknown; password?: unknown };
    if (typeof body?.email !== "string" || typeof body?.password !== "string" ||
        body.email.length > 255 || body.password.length > 200) {
      return reply.code(400).send({ error: "invalid_credentials_format" });
    }
    const session = await login(ctx.pool, body.email, body.password);
    if (!session) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    reply.setCookie(COOKIE_NAME, session.sessionId, {
      ...sessionCookie(request),
      expires: session.expiresAt
    });
    return { email: session.email, csrfToken: session.csrfToken };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[COOKIE_NAME];
    if (sessionId) await logout(ctx.pool, sessionId);
    reply.clearCookie(COOKIE_NAME, sessionCookie(request));
    return reply.code(204).send();
  });

  app.get("/api/v1/auth/me", { preHandler: requireAuth(ctx) }, async (request) => {
    return { email: request.session!.email, csrfToken: request.session!.csrfToken };
  });

  /**
   * One-time initial admin setup. Only usable while no admin exists and
   * requires the ADMIN_SETUP_TOKEN from the server environment.
   */
  app.post("/api/v1/auth/setup", async (request, reply) => {
    if ((await userCount(ctx.pool)) > 0) {
      return reply.code(409).send({ error: "setup_already_completed" });
    }
    const token = ctx.config.adminSetupToken;
    const body = request.body as { token?: unknown; email?: unknown; password?: unknown };
    if (!token || body?.token !== token) {
      return reply.code(403).send({ error: "setup_token_invalid" });
    }
    if (typeof body?.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      return reply.code(400).send({ error: "invalid_email" });
    }
    if (typeof body?.password !== "string" || body.password.length < 12 || body.password.length > 200) {
      return reply.code(400).send({ error: "password_too_weak", detail: "min 12 characters" });
    }
    await createUser(ctx.pool, body.email, body.password);
    return reply.code(201).send({ ok: true });
  });
}

export { pruneExpiredSessions };
