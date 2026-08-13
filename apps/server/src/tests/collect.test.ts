import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { AppContext } from "../context.js";
import type { Pool } from "../db.js";
import { SiteCache } from "../lib/sites.js";
import { GeoLookup } from "../lib/geo.js";
import type { ServerConfig } from "../config.js";

/**
 * Route-level tests with an in-memory pool stub. Verifies envelope
 * validation, origin enforcement and BASIC identifier stripping end-to-end.
 */

const insertedRows: unknown[][] = [];

function stubPool(): Pool {
  const stub = {
    async query(sql: string, params?: unknown) {
      if (sql.includes("FROM sites WHERE id")) {
        if ((params as { id?: string })?.id !== "site-1") return [[], []];
        return [[{
          id: "site-1",
          name: "Test",
          domain: "shop.example.org",
          allowed_origins: JSON.stringify(["https://shop.example.org"]),
          timezone: "UTC",
          retention_days: 90,
          geo_enabled: 0,
          default_tracking_mode: "basic",
          query_allowlist: "[]",
          created_at: new Date()
        }], []];
      }
      if (sql.startsWith("INSERT IGNORE INTO events")) {
        const values = (params as unknown[][][])[0]!;
        insertedRows.push(...values);
        return [{ affectedRows: values.length }, []];
      }
      if (sql.includes("SELECT 1")) return [[{ ok: 1 }], []];
      return [[], []];
    },
    async execute() {
      return [{ affectedRows: 0 }, []];
    },
    async end() {}
  };
  return stub as unknown as Pool;
}

let app: FastifyInstance;

beforeAll(async () => {
  const config = {
    env: "test",
    port: 0,
    host: "127.0.0.1",
    database: { host: "", port: 0, name: "", user: "", password: "" },
    appOrigin: "http://localhost:3000",
    cookieSecret: "x".repeat(40),
    adminSetupToken: null,
    defaultRetentionDays: 90,
    geoEnabled: false,
    geoDbPath: null,
    seedDemo: false,
    logLevel: "silent",
    dashboardDist: "/nonexistent",
    trackerDist: "/nonexistent",
    migrationsDir: "/nonexistent"
  } as ServerConfig;
  const pool = stubPool();
  const ctx: AppContext = { config, pool, sites: new SiteCache(pool, 60_000), geo: new GeoLookup() };
  app = await buildApp(ctx);
});

afterAll(async () => {
  await app.close();
});

function envelope(events: unknown[]): { site: string; events: unknown[] } {
  return { site: "site-1", events };
}

const validEvent = {
  type: "page_view",
  mode: "basic",
  timestamp: new Date().toISOString(),
  hostname: "shop.example.org",
  path: "/produkte"
};

describe("POST /api/v1/collect", () => {
  it("accepts a valid basic event from an allowed origin", async () => {
    insertedRows.length = 0;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      headers: { origin: "https://shop.example.org", "user-agent": "Mozilla/5.0 Chrome/130" },
      payload: envelope([validEvent])
    });
    expect(res.statusCode).toBe(204);
    expect(insertedRows).toHaveLength(1);
    // columns 6/7 are visitor_id / session_id — must be NULL in basic
    expect(insertedRows[0]![6]).toBeNull();
    expect(insertedRows[0]![7]).toBeNull();
  });

  it("rejects disallowed origins", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      headers: { origin: "https://evil.example.com" },
      payload: envelope([validEvent])
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects invalid envelopes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      headers: { origin: "https://shop.example.org" },
      payload: { site: "site-1", events: "not-an-array" }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects batches over the size limit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      headers: { origin: "https://shop.example.org" },
      payload: envelope(Array.from({ length: 25 }, () => validEvent))
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for unknown sites", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      payload: { site: "nope", events: [validEvent] }
    });
    expect(res.statusCode).toBe(404);
  });

  it("drops forged identifiers in basic mode before insert", async () => {
    insertedRows.length = 0;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      headers: { origin: "https://shop.example.org" },
      payload: envelope([{ ...validEvent, visitorId: "attacker-id", sessionId: "attacker-session" }])
    });
    expect(res.statusCode).toBe(204);
    expect(insertedRows[0]![6]).toBeNull();
    expect(insertedRows[0]![7]).toBeNull();
  });

  it("never includes the client IP in stored columns", async () => {
    insertedRows.length = 0;
    await app.inject({
      method: "POST",
      url: "/api/v1/collect",
      headers: { origin: "https://shop.example.org", "x-forwarded-for": "203.0.113.99" },
      payload: envelope([validEvent])
    });
    expect(JSON.stringify(insertedRows)).not.toContain("203.0.113.99");
  });
});

describe("admin API protection", () => {
  it("rejects unauthenticated analytics requests", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/analytics/overview?site=site-1" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects unauthenticated site listing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/sites" });
    expect(res.statusCode).toBe(401);
  });
});
