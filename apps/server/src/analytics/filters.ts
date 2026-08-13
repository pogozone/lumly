import type { AnalyticsFilters, TrackingMode } from "@lumly/shared";

export class FilterError extends Error {}

const PRESETS: Record<string, (now: Date) => { from: Date; to: Date }> = {
  today: (now) => {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  },
  yesterday: (now) => {
    const from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  },
  "7d": (now) => ({ from: new Date(now.getTime() - 7 * 864e5), to: now }),
  "30d": (now) => ({ from: new Date(now.getTime() - 30 * 864e5), to: now }),
  "this-month": (now) => {
    const from = new Date(now);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  },
  "last-month": (now) => {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from, to };
  }
};

function str(v: unknown, max = 255): string | undefined {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined;
}

/** Parse and validate analytics query-string filters. */
export function parseFilters(q: Record<string, unknown>): AnalyticsFilters {
  const site = str(q.site, 40);
  if (!site) throw new FilterError("site parameter required");

  const now = new Date();
  let from: Date;
  let to: Date;
  const range = str(q.range, 20) ?? "7d";
  const preset = PRESETS[range];
  if (preset) {
    ({ from, to } = preset(now));
  } else if (str(q.from) && str(q.to)) {
    from = new Date(str(q.from)!);
    to = new Date(str(q.to)!);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new FilterError("invalid custom date range");
    }
  } else {
    ({ from, to } = PRESETS["7d"]!(now));
  }
  if (from > to) throw new FilterError("from must be before to");
  // Hard cap ranges to 2 years to bound query cost.
  if (to.getTime() - from.getTime() > 2 * 366 * 864e5) {
    throw new FilterError("date range too large");
  }

  const modeRaw = str(q.mode, 12);
  let mode: TrackingMode | "all" | undefined;
  if (modeRaw === "basic" || modeRaw === "consented") mode = modeRaw;
  else if (modeRaw === "all") mode = "all";

  return {
    site,
    from: from.toISOString(),
    to: to.toISOString(),
    mode,
    path: str(q.path, 1024),
    eventName: str(q.event, 120),
    referrer: str(q.referrer),
    campaign: str(q.campaign, 120),
    device: str(q.device, 16),
    browser: str(q.browser, 64),
    os: str(q.os, 64),
    country: str(q.country, 2),
    includeBots: q.includeBots === "true"
  };
}

/** Build parameterized WHERE clause fragments for the events table. */
export function whereClause(f: AnalyticsFilters): { sql: string; params: Record<string, unknown> } {
  const parts = ["site_id = :site", "occurred_at >= :from", "occurred_at < :to"];
  const params: Record<string, unknown> = { site: f.site, from: new Date(f.from), to: new Date(f.to) };
  if (!f.includeBots) parts.push("is_bot = 0");
  if (f.mode && f.mode !== "all") {
    parts.push("tracking_mode = :mode");
    params.mode = f.mode;
  }
  if (f.path) {
    parts.push("page_path = :path");
    params.path = f.path;
  }
  if (f.eventName) {
    parts.push("event_name = :eventName");
    params.eventName = f.eventName;
  }
  if (f.referrer) {
    parts.push("referrer_host = :referrer");
    params.referrer = f.referrer;
  }
  if (f.campaign) {
    parts.push("(campaign_source = :campaign OR campaign_medium = :campaign OR campaign_name = :campaign)");
    params.campaign = f.campaign;
  }
  if (f.device) {
    parts.push("device_class = :device");
    params.device = f.device;
  }
  if (f.browser) {
    parts.push("browser_family = :browser");
    params.browser = f.browser;
  }
  if (f.os) {
    parts.push("os_family = :os");
    params.os = f.os;
  }
  if (f.country) {
    parts.push("country_code = :country");
    params.country = f.country.toUpperCase();
  }
  return { sql: parts.join(" AND "), params };
}

/** Previous-period range of equal length for comparisons. */
export function previousRange(f: AnalyticsFilters): { from: Date; to: Date } {
  const from = new Date(f.from);
  const to = new Date(f.to);
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span), to: from };
}

export function pctChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Bucket granularity for time series based on range length. */
export function bucketFormat(f: AnalyticsFilters): string {
  const spanMs = new Date(f.to).getTime() - new Date(f.from).getTime();
  if (spanMs <= 48 * 3600 * 1000) return "%Y-%m-%d %H:00:00"; // hourly
  if (spanMs <= 92 * 864e5) return "%Y-%m-%d"; // daily
  return "%Y-%u"; // weekly
}
