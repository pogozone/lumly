import type { Pool } from "../db.js";

/**
 * Rollup maintenance. Aggregates are derived from raw events and contain no
 * visitor/session identifiers, IP addresses or raw User-Agents. Rebuilds are
 * idempotent: affected buckets are replaced transactionally per site.
 */

const PERF_EXTRACT = `
  SUM(CASE WHEN event_type = 'performance' AND JSON_EXTRACT(properties, '$.lcp_ms') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.lcp_ms')) AS UNSIGNED) ELSE 0 END) AS lcp_sum_ms,
  SUM(CASE WHEN event_type = 'performance' AND JSON_EXTRACT(properties, '$.fcp_ms') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.fcp_ms')) AS UNSIGNED) ELSE 0 END) AS fcp_sum_ms,
  SUM(CASE WHEN event_type = 'performance' AND JSON_EXTRACT(properties, '$.inp_ms') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.inp_ms')) AS UNSIGNED) ELSE 0 END) AS inp_sum_ms,
  SUM(CASE WHEN event_type = 'performance' AND JSON_EXTRACT(properties, '$.ttfb_ms') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.ttfb_ms')) AS UNSIGNED) ELSE 0 END) AS ttfb_sum_ms,
  SUM(CASE WHEN event_type = 'performance' AND JSON_EXTRACT(properties, '$.load_ms') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.load_ms')) AS UNSIGNED) ELSE 0 END) AS load_sum_ms,
  SUM(CASE WHEN event_type = 'performance' AND JSON_EXTRACT(properties, '$.cls') IS NOT NULL
      THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.cls')) AS DECIMAL(10,4)) ELSE 0 END) AS cls_sum,
  SUM(CASE WHEN event_type = 'performance' THEN 1 ELSE 0 END) AS perf_samples
`;

const BASE_SELECT = `
  COUNT(CASE WHEN event_type = 'page_view' OR event_type = 'route_change' THEN 1 END) AS page_views,
  COUNT(*) AS total_events,
  COUNT(CASE WHEN (event_type = 'page_view' OR event_type = 'route_change') AND tracking_mode = 'basic' THEN 1 END) AS basic_page_views,
  COUNT(CASE WHEN (event_type = 'page_view' OR event_type = 'route_change') AND tracking_mode = 'consented' THEN 1 END) AS consented_page_views,
  COUNT(DISTINCT visitor_id) AS unique_visitors,
  COUNT(DISTINCT session_id) AS sessions,
  COALESCE(SUM(CASE WHEN event_type = 'engagement' THEN duration_ms ELSE 0 END), 0) AS engagement_ms,
  COUNT(CASE WHEN event_type = 'engagement' AND duration_ms IS NOT NULL THEN 1 END) AS engagement_samples
`;

interface DimensionSpec {
  type: string;
  expr: string;
  where?: string;
}

const DIMENSIONS: DimensionSpec[] = [
  { type: "overview", expr: "''" },
  { type: "page", expr: "page_path" },
  { type: "referrer", expr: "referrer_host", where: "referrer_host IS NOT NULL" },
  {
    type: "campaign",
    expr: "CONCAT_WS(' / ', campaign_source, campaign_medium, campaign_name)",
    where: "campaign_source IS NOT NULL OR campaign_medium IS NOT NULL OR campaign_name IS NOT NULL"
  },
  { type: "browser", expr: "browser_family", where: "browser_family IS NOT NULL" },
  { type: "os", expr: "os_family", where: "os_family IS NOT NULL" },
  { type: "device", expr: "device_class", where: "device_class IS NOT NULL" },
  { type: "country", expr: "country_code", where: "country_code IS NOT NULL" },
  {
    type: "event",
    expr: "COALESCE(event_name, event_type)",
    where: "event_type NOT IN ('page_view','route_change','performance','engagement')"
  }
];

/** Rebuild hourly rollups for [fromHour, toHour) for one site. */
export async function rebuildHourly(pool: Pool, siteId: string, from: Date, to: Date): Promise<void> {
  const fromHour = new Date(from);
  fromHour.setMinutes(0, 0, 0);
  const toHour = new Date(to);
  toHour.setMinutes(0, 0, 0);

  await pool.query(
    "DELETE FROM analytics_hourly WHERE site_id = ? AND bucket_start >= ? AND bucket_start < ?",
    [siteId, fromHour, toHour]
  );

  for (const dim of DIMENSIONS) {
    const where = dim.where ? `AND ${dim.where}` : "";
    await pool.query(
      `INSERT INTO analytics_hourly (
        site_id, bucket_start, dimension_type, dimension_value,
        page_views, total_events, basic_page_views, consented_page_views,
        unique_visitors, sessions, engagement_ms, engagement_samples,
        perf_samples, lcp_sum_ms, fcp_sum_ms, inp_sum_ms, ttfb_sum_ms, load_sum_ms, cls_sum
      )
      SELECT
        site_id,
        DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00:00') AS bucket_start,
        '${dim.type}' AS dimension_type,
        LEFT(CAST(${dim.expr} AS CHAR(255)), 255) AS dimension_value,
        ${BASE_SELECT},
        ${PERF_EXTRACT}
      FROM events
      WHERE site_id = ? AND occurred_at >= ? AND occurred_at < ? ${where}
      GROUP BY site_id, bucket_start, dimension_value`,
      [siteId, fromHour, toHour]
    );
  }
}

/** Rebuild daily rollups from hourly rollups for [fromDay, toDay). */
export async function rebuildDaily(pool: Pool, siteId: string, from: Date, to: Date): Promise<void> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  await pool.query(
    "DELETE FROM analytics_daily WHERE site_id = ? AND bucket_start >= ? AND bucket_start < ?",
    [siteId, fmt(from), fmt(to)]
  );
  await pool.query(
    `INSERT INTO analytics_daily (
      site_id, bucket_start, dimension_type, dimension_value,
      page_views, total_events, basic_page_views, consented_page_views,
      unique_visitors, sessions, engagement_ms, engagement_samples,
      perf_samples, lcp_sum_ms, fcp_sum_ms, inp_sum_ms, ttfb_sum_ms, load_sum_ms, cls_sum
    )
    SELECT
      site_id, DATE(bucket_start), dimension_type, dimension_value,
      SUM(page_views), SUM(total_events), SUM(basic_page_views), SUM(consented_page_views),
      NULL, NULL,
      SUM(engagement_ms), SUM(engagement_samples),
      SUM(perf_samples), SUM(lcp_sum_ms), SUM(fcp_sum_ms), SUM(inp_sum_ms),
      SUM(ttfb_sum_ms), SUM(load_sum_ms), SUM(cls_sum)
    FROM analytics_hourly
    WHERE site_id = ? AND bucket_start >= ? AND bucket_start < ?
    GROUP BY site_id, DATE(bucket_start), dimension_type, dimension_value`,
    [siteId, fmt(from), fmt(to)]
  );
  // Daily distinct visitor/session counts must come from raw events (hourly
  // distincts cannot be summed). Only fill them while raw data exists.
  await pool.query(
    `UPDATE analytics_daily d
     JOIN (
       SELECT site_id, DATE(occurred_at) AS day,
              COUNT(DISTINCT visitor_id) AS visitors,
              COUNT(DISTINCT session_id) AS sessions
       FROM events
       WHERE site_id = ? AND occurred_at >= ? AND occurred_at < ?
       GROUP BY site_id, day
     ) r ON r.site_id = d.site_id AND r.day = d.bucket_start
     SET d.unique_visitors = r.visitors, d.sessions = r.sessions
     WHERE d.site_id = ? AND d.dimension_type = 'overview'`,
    [siteId, from, to, siteId]
  );
}

/** Rebuild rollups for recent activity. Called periodically. */
export async function aggregateRecent(pool: Pool, siteId: string, now = new Date()): Promise<void> {
  const from = new Date(now.getTime() - 48 * 3600 * 1000);
  await rebuildHourly(pool, siteId, from, new Date(now.getTime() + 3600 * 1000));
  const dayStart = new Date(from);
  dayStart.setHours(0, 0, 0, 0);
  await rebuildDaily(pool, siteId, dayStart, new Date(now.getTime() + 24 * 3600 * 1000));
}
