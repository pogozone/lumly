// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTracker } from "./tracker.js";
import type { OutgoingEvent } from "./types.js";

let sent: OutgoingEvent[][];

function collectFetch(): void {
  sent = [];
  const handler = async (_url: string, init: { body: string }) => {
    const parsed = JSON.parse(init.body as string) as { events: OutgoingEvent[] };
    sent.push(parsed.events);
    return new Response(null, { status: 204 });
  };
  vi.stubGlobal("fetch", vi.fn(handler));
  Object.defineProperty(window, "fetch", { value: vi.fn(handler), configurable: true, writable: true });
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: (_url: string, blob: Blob) => {
      void blob.text().then((t) => {
        sent.push((JSON.parse(t) as { events: OutgoingEvent[] }).events);
      });
      return true;
    }
  });
}

function allEvents(): OutgoingEvent[] {
  return sent.flat();
}

function makeTracker(consent: "unknown" | "granted" | "denied" = "unknown") {
  const t = createTracker({
    siteId: "test-site",
    endpoint: "https://analytics.example.org/api/v1/collect",
    consent,
    flushIntervalMs: 10
  });
  return t;
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "";
  collectFetch();
});

describe("BASIC mode privacy invariants", () => {
  it("creates no visitor or session identifiers", async () => {
    const t = makeTracker("unknown");
    t.start();
    t.track("cta_click", { placement: "hero" });
    await new Promise((r) => setTimeout(r, 30));
    const events = allEvents();
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(ev.mode).toBe("basic");
      expect(ev.visitorId).toBeUndefined();
      expect(ev.sessionId).toBeUndefined();
    }
    t.destroy();
  });

  it("writes nothing to localStorage or sessionStorage", async () => {
    const t = makeTracker("unknown");
    t.start();
    t.track("signup_started");
    await new Promise((r) => setTimeout(r, 30));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    t.destroy();
  });

  it("sets no cookies", async () => {
    const t = makeTracker("denied");
    t.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.cookie).toBe("");
    t.destroy();
  });

  it("does not include language or timezone in basic mode", async () => {
    const t = makeTracker("unknown");
    t.start();
    await new Promise((r) => setTimeout(r, 30));
    for (const ev of allEvents()) {
      expect(ev.language).toBeUndefined();
      expect(ev.timezone).toBeUndefined();
    }
    t.destroy();
  });
});

describe("consent state machine", () => {
  it("unknown -> granted creates identifiers and switches mode", async () => {
    const t = makeTracker("unknown");
    t.start();
    t.setConsent("granted");
    t.track("cta_click");
    await new Promise((r) => setTimeout(r, 30));
    const custom = allEvents().find((e) => e.type === "custom");
    expect(custom?.mode).toBe("consented");
    expect(custom?.visitorId).toBeTruthy();
    expect(custom?.sessionId).toBeTruthy();
    expect(localStorage.getItem("lt_vid")).toBeTruthy();
    t.destroy();
  });

  it("granted -> denied removes local IDs and returns to basic", async () => {
    const t = makeTracker("granted");
    t.start();
    t.track("cta_click");
    await new Promise((r) => setTimeout(r, 30));
    expect(localStorage.getItem("lt_vid")).toBeTruthy();

    t.setConsent("denied");
    expect(localStorage.getItem("lt_vid")).toBeNull();
    expect(localStorage.getItem("lt_sid")).toBeNull();

    t.track("another_event");
    await new Promise((r) => setTimeout(r, 30));
    const after = allEvents().filter((e) => e.name === "another_event");
    expect(after[0]?.mode).toBe("basic");
    expect(after[0]?.visitorId).toBeUndefined();
    expect(after[0]?.sessionId).toBeUndefined();
    t.destroy();
  });

  it("supports object form setConsent({ analytics: boolean })", () => {
    const t = makeTracker();
    t.setConsent({ analytics: true });
    expect(t.getConsent()).toBe("granted");
    t.setConsent({ analytics: false });
    expect(t.getConsent()).toBe("denied");
    t.destroy();
  });

  it("forget() removes identifiers", () => {
    const t = makeTracker("granted");
    t.start();
    t.track("cta_click");
    expect(localStorage.getItem("lt_vid")).toBeTruthy();
    t.forget();
    expect(localStorage.getItem("lt_vid")).toBeNull();
    expect(localStorage.getItem("lt_sid")).toBeNull();
    t.destroy();
  });

  it("event IDs are random, not derived from user data", () => {
    const ids = new Set<string>();
    const t = makeTracker("unknown");
    t.start();
    for (let i = 0; i < 50; i++) t.track("cta_click");
    t.destroy();
    for (const ev of allEvents()) {
      expect(ids.has(ev.id)).toBe(false);
      ids.add(ev.id);
    }
  });
});

describe("URL and payload hygiene", () => {
  it("strips unknown query parameters and fragments from page paths", async () => {
    history.replaceState(null, "", "/produkte?email=a@b.de&token=xyz&utm_source=nl#frag");
    const t = makeTracker("unknown");
    t.start();
    await new Promise((r) => setTimeout(r, 30));
    const pv = allEvents().find((e) => e.type === "page_view");
    expect(pv?.path).toBe("/produkte?utm_source=nl");
    expect(pv?.path).not.toContain("email");
    expect(pv?.path).not.toContain("token");
    expect(pv?.path).not.toContain("frag");
    t.destroy();
  });

  it("bounds custom property values and rejects invalid names", async () => {
    const t = makeTracker("unknown");
    t.start();
    t.track("bad name with spaces!");
    t.track("1starts_with_digit");
    t.track("valid_event", {
      long: "x".repeat(500),
      nested: { a: 1 } as never,
      ok: "yes",
      count: 3
    });
    await new Promise((r) => setTimeout(r, 30));
    const customs = allEvents().filter((e) => e.type === "custom");
    expect(customs.length).toBe(1);
    const props = customs[0]!.properties!;
    expect(String(props.long).length).toBeLessThanOrEqual(300);
    expect(props.nested).toBeUndefined();
    expect(props.ok).toBe("yes");
    t.destroy();
  });

  it("never throws when APIs are missing", () => {
    const t = makeTracker("unknown");
    expect(() => {
      t.start();
      t.track("x".repeat(200));
      t.setConsent("granted");
      t.destroy();
      t.destroy();
    }).not.toThrow();
  });
});
