# Data Dictionary

Alle Felder der MariaDB-Tabellen. „Modus" = Basic (B) / Consented (C).

## `sites`

| Feld | Typ | Beschreibung | Beispiel |
| --- | --- | --- | --- |
| id | VARCHAR(24) | öffentliche Site-ID (kein Secret) | `demo-site-01` |
| name | VARCHAR(200) | Anzeigename | `Demo Shop` |
| domain | VARCHAR(255) | primäre Domain | `shop.example.org` |
| allowed_origins | JSON | Origin-Allowlist für den Collector | `["https://shop.example.org"]` |
| timezone | VARCHAR(64) | Zeitzonen-Label der Site | `Europe/Berlin` |
| retention_days | INT | technische Rohdaten-Retention (kein Rechtswert) | `90` |
| geo_enabled | TINYINT | grobe Geo-Auswertung aktiv | `0` |
| default_tracking_mode | ENUM | Standard-Modus der Site | `basic` |
| query_allowlist | JSON | zusätzlich erlaubte Query-Parameter | `["q"]` |
| created_at | DATETIME | Anlagezeitpunkt | — |

## `events`

| Feld | Typ | Modus | Beschreibung | Quelle | Beispiel |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT AI | B/C | technischer Primärschlüssel | DB | — |
| event_id | VARCHAR(40) | B/C | zufällige Event-ID (Dedup), nie aus Nutzerdaten abgeleitet | Tracker | `k3j9f2...` |
| site_id | VARCHAR(24) | B/C | Site-Referenz | Tracker | `demo-site-01` |
| occurred_at | DATETIME(3) | B/C | Event-Zeitpunkt (Client) | Tracker | — |
| received_at | DATETIME(3) | B/C | Empfangszeitpunkt (Server) | Server | — |
| event_type | VARCHAR(32) | B/C | `page_view`, `route_change`, `custom`, `performance`, `engagement`, `scroll_depth`, `outbound_link`, `file_download`, `form_submit` | Tracker | `page_view` |
| event_name | VARCHAR(120) | B/C | Name bei Custom Events | Tracker | `cta_click` |
| tracking_mode | ENUM | B/C | `basic` \| `consented` | Tracker | `basic` |
| visitor_id | VARCHAR(40) NULL | **nur C** | zufällige pseudonyme Besucher-ID | Tracker (localStorage) | `p9x2...` |
| session_id | VARCHAR(40) NULL | **nur C** | zufällige pseudonyme Sitzungs-ID (30 min Inaktivität) | Tracker (localStorage) | `a71k...` |
| hostname | VARCHAR(255) | B/C | Host der Seite | Tracker | `shop.example.org` |
| page_path | VARCHAR(1024) | B/C | Pfad, sanitisiert (Fragment + nicht allowlistete Query-Parameter entfernt) | Tracker+Server | `/produkte?utm_source=nl` |
| page_title | VARCHAR(512) | B/C | Seitentitel | Tracker | `Produkte` |
| referrer_host | VARCHAR(255) | B/C | Host des Referrers | Tracker | `google.com` |
| referrer_path | VARCHAR(1024) | B/C | Referrer-Pfad, **nur same-origin** | Tracker | `/suche` |
| campaign_source/medium/name/content/term | VARCHAR(120) | B/C | allowlistete UTM-Parameter | URL | `newsletter` |
| browser_family | VARCHAR(64) | B/C | grobe Browser-Familie | Server (UA abgeleitet) | `Chrome` |
| browser_version_major | SMALLINT | B/C | Browser-Hauptversion | Server | `130` |
| os_family | VARCHAR(64) | B/C | grobe OS-Familie | Server | `Windows` |
| device_class | VARCHAR(16) | B/C | `desktop`/`mobile`/`tablet`/`bot`/`unknown` | Server | `desktop` |
| language | VARCHAR(16) | nur C | Browsersprache | Tracker | `de-DE` |
| client_timezone | VARCHAR(64) | nur C | Browser-Zeitzone | Tracker | `Europe/Berlin` |
| country_code | CHAR(2) | B/C, nur bei Geo | Ländercode aus transienter Geo-Abfrage | Server | `DE` |
| region_code | VARCHAR(8) | B/C, nur bei Geo | derzeit ungenutzt (Ländergranularität) | Server | NULL |
| duration_ms | INT | B/C | Engagement-Dauer | Tracker | `12300` |
| numeric_value | DOUBLE | B/C | z. B. Scroll-Tiefe (25/50/75/100) | Tracker | `75` |
| is_bot | TINYINT | B/C | Heuristisches Bot-Flag (best effort) | Server | `0` |
| properties | JSON | B/C | sanitisierte Custom Properties / Performance-Metriken / Viewport-Bucket | Tracker | `{"placement":"hero"}` |

**Nicht vorhandene Spalten (bewusst):** IP-Adresse, vollständiger
User-Agent, Cookies, volle Querystrings, URL-Fragmente.

## `analytics_hourly` / `analytics_daily`

| Feld | Beschreibung |
| --- | --- |
| site_id, bucket_start | Rollup-Bucket |
| dimension_type | `overview` \| `page` \| `referrer` \| `campaign` \| `browser` \| `os` \| `device` \| `country` \| `event` |
| dimension_value | Dimensionswert (z. B. Pfad, Referrer-Host) |
| page_views, total_events, basic_page_views, consented_page_views | Zähler |
| unique_visitors, sessions | Distinct-Zählungen (nur Zahlen, keine IDs; NULL, wenn nicht ermittelbar) |
| engagement_ms, engagement_samples | Summen für Mittelwerte |
| perf_samples, lcp_sum_ms, fcp_sum_ms, inp_sum_ms, ttfb_sum_ms, load_sum_ms, cls_sum | Performance-Summen |

## `dashboard_users`

| Feld | Beschreibung |
| --- | --- |
| id, email, created_at, last_login_at | Admin-Konto |
| password_hash | Argon2id-Hash |

## `dashboard_sessions`

| Feld | Beschreibung |
| --- | --- |
| id | zufälliges Session-Token (HttpOnly-Cookie) |
| user_id, csrf_token, created_at, expires_at | Session-State + CSRF-Token |

## `funnel_definitions`

| Feld | Beschreibung |
| --- | --- |
| id, site_id, name, created_at | Funnel-Metadaten |
| steps | JSON: `[{type: "page"\|"event", value: string}]` |

## `retention_log`

| Feld | Beschreibung |
| --- | --- |
| id, site_id, ran_at, deleted_events | Protokoll der Retention-Läufe |

## `schema_migrations`

| Feld | Beschreibung |
| --- | --- |
| version, applied_at | Append-only Migrationshistorie |
