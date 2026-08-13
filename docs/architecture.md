# Architektur

## Übersicht

```text
Browser
   │  POST /api/v1/collect (sendBeacon / fetch keepalive)
   ▼
lumly Server (Node.js + Fastify)
   ├── Collector API       apps/server/src/routes/collect.ts
   ├── Auth API            apps/server/src/routes/auth.ts
   ├── Sites API           apps/server/src/routes/sites.ts
   ├── Analytics API       apps/server/src/analytics/*
   ├── Privacy API         apps/server/src/routes/privacy.ts
   ├── Funnels API         apps/server/src/routes/funnels.ts
   ├── Dashboard (statisch aus apps/dashboard/dist)
   ├── tracker.js          (aus packages/tracker/dist)
   └── Jobs: Aggregation (15 min), Retention (1 h), Session-Prune
           │
           ▼
        MariaDB
```

Bewusst **nicht** enthalten: Redis, Kafka, Elasticsearch, Kubernetes,
Microservices. Eine Installation besteht aus genau zwei Prozessen
(Server + MariaDB).

## Datenschutz-Invarianten (technisch erzwungen)

1. **BASIC-Modus** erzeugt keine persistente Besuchererkennung.
   Verteidigung in vier Schichten:
   - Tracker (`packages/tracker/src/tracker.ts`): `visitorId`/`sessionId`
     werden nur gesetzt, wenn `consent === "granted"`.
   - Sanitizer (`packages/shared/src/sanitize.ts`): BASIC-Events verlieren
     Identifier auch dann, wenn ein Client sie fälschlich mitsendet.
   - Collector-Service (`apps/server/src/services/events.ts`): erneute Prüfung.
   - Datenbank (`migrations/001_init.sql`): `CHECK`-Constraint verbietet
     `visitor_id`/`session_id` bei `tracking_mode = 'basic'`.
2. **Keine IP-Persistenz**: die IP wird transient für Origin-Verarbeitung,
   Rate-Limiting (nur Arbeitsspeicher) und optional Geo (vor Persistenz)
   genutzt. Sie landet weder in Tabellen noch in Logs (Fastify-Redaction).
3. **Kein roher User-Agent**: serverseitige Ableitung grober Kategorien
   (`apps/server/src/lib/ua.ts`), Rohwert wird verworfen.
4. **URL-Hygiene**: Fragmente und alle nicht allowlisteten Query-Parameter
   werden clientseitig und nochmals kanonisch serverseitig entfernt.
5. **Kanonische Sanitization**: genau eine Pipeline in `packages/shared`,
   genutzt vom Collector. Keine Streu-Sanitizer in Routen.

## Event-Pipeline

```text
HTTP POST /api/v1/collect
  -> Rate Limit (in-memory, kurzlebig)
  -> Body Limit 64 kB (Fastify)
  -> JSON Schema (ajv, Schema in packages/shared/src/schema.ts)
  -> Site Lookup (SiteCache, 30 s TTL)
  -> Origin-Allowlist
  -> sanitizeEvent() je Event (Fehler => Event verworfen, Rest bleibt)
  -> BASIC-Invariante erneut geprüft
  -> UA-Ableitung / Bot-Flag / optionale Geo-Auflösung (transient)
  -> Batch-Insert (INSERT IGNORE, Dedup über event_id)
  -> 204 No Content
```

Ungültige Events werden einzeln verworfen und niemals teilweise ungeprüft
gespeichert. Sind alle Events ungültig, antwortet der Collector mit 400.

## Analytics-Module

Jedes Modul besteht aus:

- Backend: Query in `apps/server/src/analytics/modules/<id>.ts`
  (Interface `AnalyticsModule` in `apps/server/src/analytics/types.ts`)
- Frontend: View in `apps/dashboard/src/pages/<Id>.tsx`
- Navigation: Eintrag in `apps/dashboard/src/components/Layout.tsx` (`NAV`)
  und Route in `apps/dashboard/src/App.tsx`
- Tests

Einheitliche Filter (Zeitraum, Site, Mode, Page, Event, Referrer, Kampagne,
Device, Browser, OS, Land, Bots) werden serverseitig in
`apps/server/src/analytics/filters.ts` geparst und als URL-Parameter im
Dashboard abgebildet (teilbare/bookmarkbare Views).

**Datenquellen:** Detailtabellen lesen aus `events` (indiziert, durch
Retention begrenzt). Stündliche/tägliche Rollups (`analytics_hourly`,
`analytics_daily`) werden alle 15 Minuten für die letzten 48 Stunden
idempotent neu aufgebaut und vor Retention-Löschungen für alte Zeiträume
erzeugt. Rollups enthalten niemals Identifikatoren — Distinct-Zählungen nur
als Zahlen.

## Nicht berechenbare Metriken

Kennzahlen, die persistente Wiedererkennung erfordern (Visitors, Sessions,
Entry/Exit Pages, Funnels, Retention), werden ausschließlich aus
Consented-Daten berechnet. Liegen keine vor, liefert die API `null` und das
Dashboard zeigt „n/v" statt einer Schätzung. Es gibt bewusst keine
Näherung über IP, User-Agent oder Zeitfenster.

## Hintergrund-Jobs

| Job | Intervall | Zweck |
| --- | --- | --- |
| Aggregation | 15 min | Rollups der letzten 48 h neu aufbauen |
| Retention | 1 h | Rohdaten älter als `retention_days` chunkweise (5000er-Blöcke) löschen, vorher Rollups absichern |
| Session-Prune | 1 h | abgelaufene Dashboard-Sessions entfernen |

## Sicherheit

- Argon2id-Passwort-Hashes, HttpOnly+SameSite-Session-Cookie, `Secure` in Produktion
- CSRF: Header-Token (`X-CSRF-Token`) gegen Session-Eintrag, bei allen Mutationen
- Login-Rate-Limiting (in-memory)
- SQL ausschließlich parametrisiert (mysql2 named placeholders)
- CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- Fehlerantworten ohne Stacktraces/Pfade; Logs ohne IP/Cookies/Payloads
- Öffentliche Site-IDs sind keine Secrets; Schutz via Origin-Allowlist
