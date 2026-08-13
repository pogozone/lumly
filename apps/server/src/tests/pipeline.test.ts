import { describe, expect, it } from "vitest";
import type { Site } from "@lumly/shared";
import { processEvents } from "../services/events.js";
import { GeoLookup } from "../lib/geo.js";
import { parseUserAgent } from "../lib/ua.js";

const site: Site = {
  id: "site-1",
  name: "Test",
  domain: "shop.example.org",
  allowedOrigins: ["https://shop.example.org"],
  timezone: "UTC",
  retentionDays: 90,
  geoEnabled: false,
  defaultTrackingMode: "basic",
  queryAllowlist: [],
  createdAt: new Date().toISOString()
};

const geo = new GeoLookup();

function ev(overrides: Record<string, unknown> = {}) {
  return {
    type: "page_view",
    mode: "basic",
    timestamp: new Date().toISOString(),
    hostname: "shop.example.org",
    path: "/produkte",
    ...overrides
  } as never;
}

describe("collector pipeline privacy invariants", () => {
  it("BASIC events never carry visitor/session IDs, even if forged", () => {
    const { rows } = processEvents(
      site,
      [ev({ visitorId: "forged-visitor", sessionId: "forged-session" })],
      "Mozilla/5.0",
      "203.0.113.10",
      geo
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.visitorId).toBeNull();
    expect(rows[0]!.sessionId).toBeNull();
    expect(rows[0]!.mode).toBe("basic");
  });

  it("stores no IP address anywhere in the sanitized event", () => {
    const { rows } = processEvents(site, [ev()], "Mozilla/5.0", "203.0.113.10", geo);
    const json = JSON.stringify(rows[0]);
    expect(json).not.toContain("203.0.113.10");
  });

  it("rejects events with JWTs in paths and suspicious properties", () => {
    const { rows, rejected } = processEvents(
      site,
      [
        ev({ path: "/reset?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" }),
        ev({ properties: { email: "max@example.org", placement: "hero" } })
      ],
      "Mozilla/5.0",
      "203.0.113.10",
      geo
    );
    // first event accepted but query param stripped
    expect(rows[0]!.pagePath).toBe("/reset");
    // second accepted with suspicious property dropped
    expect(rows[1]!.properties).toEqual({ placement: "hero" });
    expect(rejected).toHaveLength(0);
  });

  it("rejects invalid events instead of partially storing them", () => {
    const { rows, rejected } = processEvents(
      site,
      [ev({ type: "session_record" }), ev({ mode: "stealth" }), ev({ timestamp: "not-a-date" })],
      "Mozilla/5.0",
      "203.0.113.10",
      geo
    );
    expect(rows).toHaveLength(0);
    expect(rejected).toHaveLength(3);
  });

  it("marks known bot user agents", () => {
    expect(parseUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)").isBot).toBe(true);
    expect(parseUserAgent("curl/8.0 HeadlessChrome").isBot).toBe(true);
    expect(parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0").isBot).toBe(false);
  });

  it("derives only coarse categories from the User-Agent", () => {
    const ua = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1");
    expect(ua.browserFamily).toBe("Safari");
    expect(ua.osFamily).toBe("iOS");
    expect(ua.deviceClass).toBe("mobile");
    // raw UA must not appear in derived fields
    expect(JSON.stringify(ua)).not.toContain("Mozilla");
  });
});
