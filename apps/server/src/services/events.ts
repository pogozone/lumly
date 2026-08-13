import {
  SanitizeError,
  sanitizeEvent,
  type IncomingEvent,
  type SanitizedEvent,
  type Site
} from "@lumly/shared";
import type { Pool } from "../db.js";
import { parseUserAgent } from "../lib/ua.js";
import type { GeoLookup } from "../lib/geo.js";

export interface ProcessResult {
  accepted: number;
  rejected: Array<{ index: number; code: string }>;
}

/**
 * Canonical event pipeline: sanitize -> derive coarse server-side fields ->
 * batch insert. Defence in depth: BASIC identifier invariants are enforced
 * in the sanitizer, again here, and at the database via CHECK constraint.
 */
export function processEvents(
  site: Site,
  rawEvents: IncomingEvent[],
  userAgent: string | undefined,
  clientIp: string,
  geo: GeoLookup
): { rows: SanitizedEvent[]; rejected: ProcessResult["rejected"] } {
  const rows: SanitizedEvent[] = [];
  const rejected: ProcessResult["rejected"] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    try {
      const ev = sanitizeEvent(rawEvents[i]!, { queryAllowlist: site.queryAllowlist });
      if (ev.mode === "basic" && (ev.visitorId !== null || ev.sessionId !== null)) {
        throw new SanitizeError("basic_ids", "basic events must not carry identifiers");
      }
      rows.push(ev);
    } catch (err) {
      rejected.push({
        index: i,
        code: err instanceof SanitizeError ? err.code : "invalid"
      });
    }
  }
  return { rows, rejected };
}

const INSERT_SQL = `INSERT IGNORE INTO events (
  event_id, site_id, occurred_at, event_type, event_name, tracking_mode,
  visitor_id, session_id, hostname, page_path, page_title,
  referrer_host, referrer_path,
  campaign_source, campaign_medium, campaign_name, campaign_content, campaign_term,
  browser_family, browser_version_major, os_family, device_class,
  language, client_timezone, country_code, region_code,
  duration_ms, numeric_value, is_bot, properties
) VALUES ?`;

export async function insertEvents(
  pool: Pool,
  site: Site,
  events: SanitizedEvent[],
  userAgent: string | undefined,
  clientIp: string,
  geo: GeoLookup
): Promise<number> {
  if (events.length === 0) return 0;
  // Raw User-Agent and IP are used transiently here and never persisted.
  const ua = parseUserAgent(userAgent);
  const geoEnabled = geo.enabled && site.geoEnabled;
  const values = events.map((ev) => {
    let countryCode: string | null = null;
    let regionCode: string | null = null;
    if (geoEnabled) {
      const g = geo.lookup(clientIp);
      countryCode = g.countryCode;
      regionCode = g.regionCode;
    }
    return [
      ev.eventId,
      site.id,
      ev.occurredAt,
      ev.type,
      ev.name,
      ev.mode,
      ev.visitorId,
      ev.sessionId,
      ev.hostname,
      ev.pagePath,
      ev.pageTitle,
      ev.referrerHost,
      ev.referrerPath,
      ev.campaignSource,
      ev.campaignMedium,
      ev.campaignName,
      ev.campaignContent,
      ev.campaignTerm,
      ua.browserFamily,
      ua.browserVersionMajor,
      ua.osFamily,
      ua.deviceClass,
      ev.language,
      ev.timezone,
      countryCode,
      regionCode,
      ev.durationMs,
      ev.numericValue,
      ua.isBot ? 1 : 0,
      ev.properties ? JSON.stringify(ev.properties) : null
    ];
  });
  const [result] = await pool.query(INSERT_SQL, [values]);
  return (result as { affectedRows: number }).affectedRows;
}
