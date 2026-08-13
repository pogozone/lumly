import { randomId } from "@lumly/shared";
import type { Pool } from "../db.js";
import { query } from "../db.js";
import { createSite } from "../lib/sites.js";
import { rebuildDaily, rebuildHourly } from "./aggregate.js";

/** Deterministic PRNG so demo data is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAGES = [
  ["/", "Home"],
  ["/produkte", "Produkte"],
  ["/produkte/schuh-runner", "Runner Schuh"],
  ["/preise", "Preise"],
  ["/blog/dsgvo-analytics", "Blog: Datenschutzfreundliche Analytics"],
  ["/blog/server-side-tracking", "Blog: Server-Side Tracking"],
  ["/checkout", "Checkout"],
  ["/danke", "Danke"],
  ["/ueber-uns", "Über uns"],
  ["/kontakt", "Kontakt"]
] as const;

const REFERRERS = [null, null, "google.com", "google.com", "bing.com", "newsletter.example.org", "github.com", "linkedin.com"];
const CAMPAIGNS: Array<[string, string, string] | null> = [
  null, null, null,
  ["newsletter", "email", "oktober_launch"],
  ["google", "cpc", "herbst_sale"],
  ["mastodon", "social", "launch_week"]
];
const BROWSERS: Array<[string, number, string, string]> = [
  ["Chrome", 130, "Windows", "desktop"],
  ["Chrome", 130, "Android", "mobile"],
  ["Firefox", 132, "Linux", "desktop"],
  ["Safari", 18, "iOS", "mobile"],
  ["Safari", 18, "macOS", "desktop"],
  ["Edge", 130, "Windows", "desktop"]
];
const LANGUAGES = ["de-DE", "de-DE", "de-AT", "en-US", "en-GB", "fr-FR"];
const CUSTOM_EVENTS: Array<[string, Record<string, string | number | boolean>]> = [
  ["cta_click", { placement: "hero", variant: "blue" }],
  ["cta_click", { placement: "footer", variant: "green" }],
  ["signup_started", { source: "pricing" }],
  ["purchase_completed", { plan: "pro" }],
  ["doc_copy", { page: "integration" }]
];

export const DEMO_SITE_ID = "demo-site-01";

/** Seed demo data. No real personal data; identifiers are random. */
export async function seedDemoData(pool: Pool, log: (msg: string) => void): Promise<void> {
  const existing = await query<{ n: number }>(pool, "SELECT COUNT(*) AS n FROM sites");
  if (Number(existing[0]?.n ?? 0) > 0) {
    log("Seed skipped: sites already exist");
    return;
  }

  await createSite(pool, {
    id: DEMO_SITE_ID,
    name: "Demo Shop",
    domain: "demo.example.org",
    allowedOrigins: ["https://demo.example.org", "http://localhost:8080"],
    timezone: "Europe/Berlin",
    retentionDays: 90,
    geoEnabled: false,
    queryAllowlist: []
  });

  const rnd = mulberry32(42);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const now = Date.now();
  const values: unknown[][] = [];

  const visitors: string[] = [];
  for (let i = 0; i < 120; i++) visitors.push(randomId());

  for (let day = 30; day >= 0; day--) {
    const dayStart = new Date(now - day * 864e5);
    dayStart.setHours(6, 0, 0, 0);
    const dayVolume = Math.round(60 + 40 * Math.sin(day / 4) + rnd() * 50 + (30 - day) * 1.5);

    for (let i = 0; i < dayVolume; i++) {
      const consented = rnd() < 0.55;
      const visitorId = consented ? pick(visitors) : null;
      const sessionId = visitorId ? `${visitorId.slice(0, 12)}${Math.floor(day + i / 4)}` : null;
      const ts = new Date(dayStart.getTime() + rnd() * 14 * 3600 * 1000);
      const [path, title] = pick(PAGES);
      const ref = pick(REFERRERS);
      const campaign = pick(CAMPAIGNS);
      const [browser, browserMajor, os, device] = pick(BROWSERS);

      values.push([
        randomId(), DEMO_SITE_ID, ts, "page_view", null, consented ? "consented" : "basic",
        visitorId, sessionId, "demo.example.org", path, title,
        ref, ref === "demo.example.org" ? "/" : null,
        campaign?.[0] ?? null, campaign?.[1] ?? null, campaign?.[2] ?? null, null, null,
        browser, browserMajor, os, device,
        pick(LANGUAGES), consented ? "Europe/Berlin" : null,
        null, null, null, null, 0,
        JSON.stringify({ viewport: pick(["s", "m", "l", "xl"]) })
      ]);

      if (consented) {
        // engagement
        values.push([
          randomId(), DEMO_SITE_ID, new Date(ts.getTime() + 5000), "engagement", null, "consented",
          visitorId, sessionId, "demo.example.org", path, title,
          null, null, null, null, null, null, null,
          browser, browserMajor, os, device, null, null, null, null,
          Math.round(3000 + rnd() * 90000), null, 0, null
        ]);
        // scroll depth
        const depth = pick([25, 50, 75, 100]);
        values.push([
          randomId(), DEMO_SITE_ID, new Date(ts.getTime() + 6000), "scroll_depth", null, "consented",
          visitorId, sessionId, "demo.example.org", path, title,
          null, null, null, null, null, null, null,
          browser, browserMajor, os, device, null, null, null, null,
          null, depth, 0, null
        ]);
        // custom event
        if (rnd() < 0.3) {
          const [name, props] = pick(CUSTOM_EVENTS);
          values.push([
            randomId(), DEMO_SITE_ID, new Date(ts.getTime() + 7000), "custom", name, "consented",
            visitorId, sessionId, "demo.example.org", path, title,
            null, null, null, null, null, null, null,
            browser, browserMajor, os, device, null, null, null, null,
            null, null, 0, JSON.stringify(props)
          ]);
        }
      }
      // performance (both modes, no identifiers)
      values.push([
        randomId(), DEMO_SITE_ID, new Date(ts.getTime() + 2000), "performance", null, consented ? "consented" : "basic",
        visitorId, sessionId, "demo.example.org", path, title,
        null, null, null, null, null, null, null,
        browser, browserMajor, os, device, null, null, null, null,
        null, null, 0,
        JSON.stringify({
          ttfb_ms: Math.round(80 + rnd() * 400),
          fcp_ms: Math.round(400 + rnd() * 1200),
          lcp_ms: Math.round(800 + rnd() * 2500),
          inp_ms: Math.round(50 + rnd() * 300),
          dcl_ms: Math.round(600 + rnd() * 1500),
          load_ms: Math.round(900 + rnd() * 3000),
          cls: Math.round(rnd() * 25) / 100
        })
      ]);
    }
  }

  const SQL = `INSERT INTO events (
    event_id, site_id, occurred_at, event_type, event_name, tracking_mode,
    visitor_id, session_id, hostname, page_path, page_title,
    referrer_host, referrer_path,
    campaign_source, campaign_medium, campaign_name, campaign_content, campaign_term,
    browser_family, browser_version_major, os_family, device_class,
    language, client_timezone, country_code, region_code,
    duration_ms, numeric_value, is_bot, properties
  ) VALUES ?`;

  const CHUNK = 2000;
  for (let i = 0; i < values.length; i += CHUNK) {
    await pool.query(SQL, [values.slice(i, i + CHUNK)]);
  }
  log(`Seeded ${values.length} demo events`);

  const from = new Date(now - 31 * 864e5);
  from.setHours(0, 0, 0, 0);
  await rebuildHourly(pool, DEMO_SITE_ID, from, new Date(now + 3600e3));
  await rebuildDaily(pool, DEMO_SITE_ID, from, new Date(now + 864e5));
  log("Rollups rebuilt for demo data");
}
