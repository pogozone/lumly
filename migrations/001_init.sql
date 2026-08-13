-- lumly initial schema (MariaDB 10.6+)
-- Privacy invariants are enforced at the database level where practical.

CREATE TABLE IF NOT EXISTS sites (
  id                   VARCHAR(24)  NOT NULL PRIMARY KEY,
  name                 VARCHAR(200) NOT NULL,
  domain               VARCHAR(255) NOT NULL,
  allowed_origins      JSON         NOT NULL,
  timezone             VARCHAR(64)  NOT NULL DEFAULT 'UTC',
  retention_days       INT UNSIGNED NOT NULL DEFAULT 90,
  geo_enabled          TINYINT(1)   NOT NULL DEFAULT 0,
  default_tracking_mode ENUM('basic','consented') NOT NULL DEFAULT 'basic',
  query_allowlist      JSON         NOT NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id              VARCHAR(40)  NOT NULL,
  site_id               VARCHAR(24)  NOT NULL,
  occurred_at           DATETIME(3)  NOT NULL,
  received_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  event_type            VARCHAR(32)  NOT NULL,
  event_name            VARCHAR(120) NULL,
  tracking_mode         ENUM('basic','consented') NOT NULL,

  -- Pseudonymous identifiers: consented mode only, enforced by CHECK below.
  visitor_id            VARCHAR(40)  NULL,
  session_id            VARCHAR(40)  NULL,

  hostname              VARCHAR(255) NOT NULL,
  page_path             VARCHAR(1024) NOT NULL,
  page_title            VARCHAR(512) NULL,

  referrer_host         VARCHAR(255) NULL,
  referrer_path         VARCHAR(1024) NULL,

  campaign_source       VARCHAR(120) NULL,
  campaign_medium       VARCHAR(120) NULL,
  campaign_name         VARCHAR(120) NULL,
  campaign_content      VARCHAR(120) NULL,
  campaign_term         VARCHAR(120) NULL,

  -- Coarse, server-derived client categories. Raw User-Agent is never stored.
  browser_family        VARCHAR(64)  NULL,
  browser_version_major SMALLINT UNSIGNED NULL,
  os_family             VARCHAR(64)  NULL,
  device_class          VARCHAR(16)  NULL,

  language              VARCHAR(16)  NULL,
  client_timezone       VARCHAR(64)  NULL,

  -- Coarse geo only, only when geo is enabled for the site. Raw IP never stored.
  country_code          CHAR(2)      NULL,
  region_code           VARCHAR(8)   NULL,

  duration_ms           INT UNSIGNED NULL,
  numeric_value         DOUBLE       NULL,
  is_bot                TINYINT(1)   NOT NULL DEFAULT 0,

  properties            JSON         NULL,

  CONSTRAINT uq_events_event_id UNIQUE (event_id),
  CONSTRAINT fk_events_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  CONSTRAINT chk_basic_no_ids CHECK (
    tracking_mode = 'consented' OR (visitor_id IS NULL AND session_id IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_events_site_time        ON events (site_id, occurred_at);
CREATE INDEX idx_events_site_type_time   ON events (site_id, event_type, occurred_at);
CREATE INDEX idx_events_site_path_time   ON events (site_id, page_path(191), occurred_at);
CREATE INDEX idx_events_site_visitor_time ON events (site_id, visitor_id, occurred_at);
CREATE INDEX idx_events_site_session_time ON events (site_id, session_id, occurred_at);

CREATE TABLE IF NOT EXISTS dashboard_users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at  DATETIME(3)  NULL,
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id          CHAR(32)     NOT NULL PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  csrf_token  CHAR(32)     NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at  DATETIME(3)  NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funnel_definitions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id    VARCHAR(24)  NOT NULL,
  name       VARCHAR(200) NOT NULL,
  steps      JSON         NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_funnel_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS retention_log (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id        VARCHAR(24)     NOT NULL,
  ran_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_events BIGINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_retention_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INT UNSIGNED NOT NULL PRIMARY KEY,
  applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
