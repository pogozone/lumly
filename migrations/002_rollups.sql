-- lumly rollup tables.
-- Aggregates never contain visitor_id, session_id, IP addresses or raw User-Agents.
-- Counts of distinct consented visitors/sessions are stored as plain numbers.

CREATE TABLE IF NOT EXISTS analytics_hourly (
  site_id            VARCHAR(24)  NOT NULL,
  bucket_start       DATETIME     NOT NULL,
  dimension_type     ENUM('overview','page','referrer','campaign','browser','os','device','country','event') NOT NULL,
  dimension_value    VARCHAR(255) NOT NULL DEFAULT '',
  page_views         INT UNSIGNED NOT NULL DEFAULT 0,
  total_events       INT UNSIGNED NOT NULL DEFAULT 0,
  basic_page_views   INT UNSIGNED NOT NULL DEFAULT 0,
  consented_page_views INT UNSIGNED NOT NULL DEFAULT 0,
  unique_visitors    INT UNSIGNED NULL,
  sessions           INT UNSIGNED NULL,
  engagement_ms      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  engagement_samples INT UNSIGNED NOT NULL DEFAULT 0,
  perf_samples       INT UNSIGNED NOT NULL DEFAULT 0,
  lcp_sum_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  fcp_sum_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  inp_sum_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ttfb_sum_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  load_sum_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cls_sum            DOUBLE        NOT NULL DEFAULT 0,
  CONSTRAINT pk_analytics_hourly PRIMARY KEY (site_id, bucket_start, dimension_type, dimension_value),
  CONSTRAINT fk_ah_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily (
  site_id            VARCHAR(24)  NOT NULL,
  bucket_start       DATE         NOT NULL,
  dimension_type     ENUM('overview','page','referrer','campaign','browser','os','device','country','event') NOT NULL,
  dimension_value    VARCHAR(255) NOT NULL DEFAULT '',
  page_views         INT UNSIGNED NOT NULL DEFAULT 0,
  total_events       INT UNSIGNED NOT NULL DEFAULT 0,
  basic_page_views   INT UNSIGNED NOT NULL DEFAULT 0,
  consented_page_views INT UNSIGNED NOT NULL DEFAULT 0,
  unique_visitors    INT UNSIGNED NULL,
  sessions           INT UNSIGNED NULL,
  engagement_ms      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  engagement_samples INT UNSIGNED NOT NULL DEFAULT 0,
  perf_samples       INT UNSIGNED NOT NULL DEFAULT 0,
  lcp_sum_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  fcp_sum_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  inp_sum_ms         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ttfb_sum_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  load_sum_ms        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cls_sum            DOUBLE        NOT NULL DEFAULT 0,
  CONSTRAINT pk_analytics_daily PRIMARY KEY (site_id, bucket_start, dimension_type, dimension_value),
  CONSTRAINT fk_ad_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
