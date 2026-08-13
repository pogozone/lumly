# lumly

Privacy-first, self-hosted web analytics. First-party only, no third-party
dependencies, no fingerprinting, no cookies in the default tracking mode.

> **Hinweis:** lumly ist technisch auf datenschutzfreundlichen Betrieb
> ausgelegt. Ob eine konkrete Installation DSGVO-/TDDDG-konform betrieben
> wird, hängt von Konfiguration, Zweck, Rechtsgrundlage, Einwilligungsmanagement
> und Datenschutzerklärung des Betreibers ab. Siehe
> [docs/legal-checklist.md](docs/legal-checklist.md).

## Architektur

```text
Browser
   │
   ▼
lumly Tracker (<= 8 kB gzip Ziel)
   │
   ▼
lumly Server (Fastify)
   ├── POST /api/v1/collect   (öffentlich, keine Dashboard-Auth)
   ├── /api/v1/auth|sites|analytics|funnels|privacy (authentifiziert)
   ├── Dashboard (statisch ausgeliefert)
   ├── tracker.js
   └── Aggregations- / Retention-Jobs
           │
           ▼
        MariaDB
```

## Zwei Tracking-Modi

- **BASIC** (Standard): keine Cookies, kein localStorage/sessionStorage, keine
  Visitor-/Session-IDs, kein Fingerprinting, keine IP-Speicherung. Metriken,
  die persistente Wiedererkennung erfordern (Visitors, Sessions, Retention,
  geordnete Funnels), werden als *nicht verfügbar* dargestellt statt geraten.
- **CONSENTED**: erst nach expliziter Einwilligung (`tracker.setConsent("granted")`)
  werden zufällige, pseudonyme `visitor_id`/`session_id` erzeugt. Widerruf
  löscht lokale IDs sofort; serverseitige Löschung via Privacy-API oder
  `tracker.forget()` clientseitig.

Details: [docs/privacy-design.md](docs/privacy-design.md).

## Schnellstart (Docker)

```bash
cp .env.example .env
# .env ausfüllen: DATABASE_PASSWORD, COOKIE_SECRET (>= 32 Zeichen), ADMIN_SETUP_TOKEN
docker compose up -d --build
docker compose exec lumly pnpm --filter @lumly/server create-admin admin@example.org '<sicheres-passwort>'
```

Dashboard: `http://localhost:3000`. Dort eine Site anlegen, das
Integrationssnippet kopieren und in die eigene Webseite einbauen.

## Integration (Webseite)

```html
<script
  defer
  src="https://analytics.example.org/tracker.js"
  data-site="SITE_ID"
  data-endpoint="https://analytics.example.org/api/v1/collect">
</script>
```

Consent-Anbindung und Framework-Beispiele: [docs/integration.md](docs/integration.md).

## Entwicklung

Voraussetzungen: Node.js 22, pnpm 9, MariaDB 11 (oder Docker).

```bash
pnpm install
docker compose up -d mariadb      # nur Datenbank
cp .env.example .env              # DATABASE_HOST=127.0.0.1
pnpm migrate
pnpm create-admin admin@example.org '<passwort>'
pnpm seed                         # optionale Demo-Daten
pnpm dev                          # Server + Dashboard (Vite) parallel
```

Tests:

```bash
pnpm test                         # alle Tests
pnpm test:privacy                 # Privacy-Blocker-Tests (Sanitizer + Tracker)
pnpm typecheck
```

Privacy-Tests sind Build-Blocker: schlagen sie fehl, gilt der Build nicht als
erfolgreich.

## Projektstruktur

```text
apps/server        Fastify-Server (Collector, Analytics-API, Auth, Jobs)
apps/dashboard     React/Vite-Dashboard
packages/tracker   Browser-SDK (@lumly/browser)
packages/shared    Geteilte Typen + kanonische Sanitization-Pipeline
migrations         Append-only SQL-Migrationen
docs               Architektur, Integration, Privacy, Legal, Data Dictionary
```

## Konfiguration

Siehe [.env.example](.env.example). Wichtig:

- `GEO_ENABLED=false` ist Standard. Geo-Auswertung nur mit lokaler MMDB-Datei,
  Ergebnis auf Länderebene; rechtliche Bewertung obliegt dem Betreiber.
- `DEFAULT_RETENTION_DAYS=90` ist eine technische Voreinstellung, keine
  Rechtsaussage.
- Die Standardinstallation sendet **keinerlei** Telemetrie nach außen.

## Dokumentation

- [docs/architecture.md](docs/architecture.md)
- [docs/integration.md](docs/integration.md)
- [docs/privacy-design.md](docs/privacy-design.md)
- [docs/data-dictionary.md](docs/data-dictionary.md)
- [docs/legal-checklist.md](docs/legal-checklist.md)
- [docs/custom-events.md](docs/custom-events.md)

## Lizenz

Siehe Repository-Hinweise des Betreibers.
