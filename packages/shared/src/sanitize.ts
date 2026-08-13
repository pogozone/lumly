import {
  CAMPAIGN_PARAMS,
  EVENT_TYPES,
  LIMITS,
  SUSPICIOUS_PROPERTY_NAMES,
  TRACKING_MODES
} from "./constants.js";
import type {
  IncomingEvent,
  Primitive,
  SanitizedEvent
} from "./types.js";

export class SanitizeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SanitizeError";
    this.code = code;
  }
}

/** Remove control characters (except none are kept) and trim. */
export function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
}

export function truncate(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}

export function cleanString(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const cleaned = truncate(stripControlChars(input), max);
  return cleaned.length > 0 ? cleaned : null;
}

/** Random ID with ~120 bits of entropy. Not derivable from user data. */
export function randomId(): string {
  const bytes = new Uint8Array(15);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(36).padStart(2, "0").slice(-2);
  return out.slice(0, 26);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{2,}\b/;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/i;
const CC_RE = /\b(?:\d[ -]?){13,19}\b/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function looksLikeJwt(value: string): boolean {
  return JWT_RE.test(value);
}

export function looksLikeBearerToken(value: string): boolean {
  return BEARER_RE.test(value);
}

/** Heuristic: 13-19 digits (optionally space/dash grouped). Defence in depth only. */
export function looksLikeCreditCard(value: string): boolean {
  return CC_RE.test(value);
}

export function looksSensitive(value: string): boolean {
  return (
    looksLikeEmail(value) ||
    looksLikeJwt(value) ||
    looksLikeBearerToken(value) ||
    looksLikeCreditCard(value)
  );
}

export function isSuspiciousPropertyName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z_]/g, "");
  return (SUSPICIOUS_PROPERTY_NAMES as readonly string[]).some(
    (bad) => normalized === bad.replace(/[^a-z_]/g, "") || normalized.includes(bad.replace(/[^a-z_]/g, ""))
  );
}

/**
 * Sanitize custom event properties. Only primitives, bounded count and
 * lengths; suspicious keys and sensitive-looking values are dropped.
 */
export function sanitizeProperties(
  input: unknown
): Record<string, Primitive> | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new SanitizeError("properties_type", "properties must be an object");
  }
  const out: Record<string, Primitive> = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    count += 1;
    if (count > LIMITS.maxProperties) {
      throw new SanitizeError("properties_count", "too many properties");
    }
    const key = cleanString(rawKey, LIMITS.maxPropertyKeyLength);
    if (!key) continue;
    if (isSuspiciousPropertyName(key)) continue;

    if (rawValue === null) {
      out[key] = null;
      continue;
    }
    const t = typeof rawValue;
    if (t === "boolean") {
      out[key] = rawValue as boolean;
      continue;
    }
    if (t === "number") {
      if (!Number.isFinite(rawValue as number)) continue;
      out[key] = rawValue as number;
      continue;
    }
    if (t === "string") {
      const v = cleanString(rawValue, LIMITS.maxPropertyStringLength);
      if (v === null) continue;
      if (looksSensitive(v)) continue;
      out[key] = v;
      continue;
    }
    // objects, arrays, undefined: not allowed
    throw new SanitizeError(
      "properties_value_type",
      `property "${key}" has unsupported value type`
    );
  }
  return Object.keys(out).length > 0 ? out : null;
}

export interface SanitizedUrl {
  hostname: string;
  path: string;
  campaign: {
    source: string | null;
    medium: string | null;
    name: string | null;
    content: string | null;
    term: string | null;
  };
}

/**
 * Canonical URL sanitizer. Strips fragments and all query parameters except
 * an explicit allowlist (site-configured plus UTM campaign params).
 */
export function sanitizeUrl(rawUrl: string, extraAllowedParams: readonly string[] = []): SanitizedUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SanitizeError("url_invalid", "invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SanitizeError("url_protocol", "unsupported URL protocol");
  }
  const hostname = cleanString(url.hostname.toLowerCase(), LIMITS.maxHostnameLength);
  if (!hostname) throw new SanitizeError("url_host", "missing hostname");

  const allowed = new Set<string>([...CAMPAIGN_PARAMS, ...extraAllowedParams]);
  const campaign = { source: null, medium: null, name: null, content: null, term: null } as SanitizedUrl["campaign"];
  let path = url.pathname || "/";
  const kept: string[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (!allowed.has(key.toLowerCase())) continue;
    const v = cleanString(value, LIMITS.maxCampaignParamLength);
    if (v === null || looksSensitive(v)) continue;
    kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    if (key === "utm_source") campaign.source = v;
    else if (key === "utm_medium") campaign.medium = v;
    else if (key === "utm_campaign") campaign.name = v;
    else if (key === "utm_content") campaign.content = v;
    else if (key === "utm_term") campaign.term = v;
  }
  if (kept.length > 0) path += `?${kept.join("&")}`;
  path = truncate(path, LIMITS.maxPathLength);
  // fragment (url.hash) is never used
  return { hostname, path, campaign };
}

export interface SanitizedReferrer {
  host: string | null;
  /** Only retained for same-origin referrers. */
  path: string | null;
}

export function sanitizeReferrer(raw: unknown, ownHostname: string): SanitizedReferrer {
  if (typeof raw !== "string" || raw.length === 0) return { host: null, path: null };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { host: null, path: null };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { host: null, path: null };
  const host = cleanString(url.hostname.toLowerCase(), LIMITS.maxHostnameLength);
  if (!host) return { host: null, path: null };
  if (host === ownHostname) {
    return { host, path: truncate(url.pathname || "/", LIMITS.maxReferrerLength) };
  }
  return { host, path: null };
}

export interface SanitizeEventOptions {
  /** Site-specific extra query parameters allowed to persist in paths. */
  queryAllowlist?: readonly string[];
  /** Server clock used to validate timestamps. */
  now?: Date;
}

/**
 * Canonical event sanitization. Enforces the BASIC invariant:
 * basic events must not carry visitor/session identifiers.
 */
export function sanitizeEvent(raw: IncomingEvent, options: SanitizeEventOptions = {}): SanitizedEvent {
  if (raw === null || typeof raw !== "object") {
    throw new SanitizeError("event_type_invalid", "event must be an object");
  }
  if (!EVENT_TYPES.includes(raw.type)) {
    throw new SanitizeError("event_type_invalid", "unknown event type");
  }
  if (!TRACKING_MODES.includes(raw.mode)) {
    throw new SanitizeError("mode_invalid", "unknown tracking mode");
  }

  const occurredAt = new Date(raw.timestamp);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new SanitizeError("timestamp_invalid", "invalid timestamp");
  }
  const now = options.now ?? new Date();
  const skewMs = 24 * 60 * 60 * 1000;
  if (occurredAt.getTime() - now.getTime() > skewMs) {
    throw new SanitizeError("timestamp_future", "timestamp too far in the future");
  }

  const eventId =
    typeof raw.id === "string" && /^[a-z0-9]{8,40}$/i.test(raw.id) && raw.id.length <= LIMITS.maxEventIdLength
      ? raw.id
      : randomId();

  let name: string | null = null;
  if (raw.type === "custom") {
    const n = cleanString(raw.name, LIMITS.maxEventNameLength);
    if (!n || !LIMITS.eventNamePattern.test(n)) {
      throw new SanitizeError("event_name_invalid", "invalid custom event name");
    }
    if (isSuspiciousPropertyName(n)) {
      throw new SanitizeError("event_name_invalid", "event name not allowed");
    }
    name = n;
  }

  const url = sanitizeUrl(buildUrl(raw), options.queryAllowlist ?? []);
  const referrer = sanitizeReferrer(raw.referrer, url.hostname);
  const title = cleanString(raw.title, LIMITS.maxTitleLength);

  let visitorId: string | null = null;
  let sessionId: string | null = null;
  if (raw.mode === "consented") {
    visitorId = cleanString(raw.visitorId, 40);
    sessionId = cleanString(raw.sessionId, 40);
  }
  // BASIC: identifiers are force-dropped regardless of what the client sent.

  const properties = sanitizeProperties(raw.properties);
  const rawExtra = raw as unknown as Record<string, unknown>;
  const language = cleanString(rawExtra.language, LIMITS.maxLanguageLength);
  const timezone = cleanString(rawExtra.timezone, LIMITS.maxTimezoneLength);

  const durationMs =
    typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs) && raw.durationMs >= 0
      ? Math.min(Math.round(raw.durationMs), 24 * 60 * 60 * 1000)
      : null;
  const numericValue =
    typeof raw.value === "number" && Number.isFinite(raw.value) ? raw.value : null;

  return {
    eventId,
    type: raw.type,
    name,
    mode: raw.mode,
    occurredAt,
    visitorId,
    sessionId,
    hostname: url.hostname,
    pagePath: url.path,
    pageTitle: title,
    referrerHost: referrer.host,
    referrerPath: referrer.path,
    campaignSource: url.campaign.source,
    campaignMedium: url.campaign.medium,
    campaignName: url.campaign.name,
    campaignContent: url.campaign.content,
    campaignTerm: url.campaign.term,
    language,
    timezone,
    durationMs,
    numericValue,
    properties
  };
}

function buildUrl(raw: IncomingEvent): string {
  const host = typeof raw.hostname === "string" ? raw.hostname : "";
  const path = typeof raw.path === "string" ? raw.path : "/";
  if (!host) throw new SanitizeError("url_host", "missing hostname");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `https://${host}${p}`;
}
