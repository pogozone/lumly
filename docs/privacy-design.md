# Privacy Design

Dieses Dokument beschreibt nachvollziehbar, welche Daten lumly wann,
warum und wo verarbeitet. Es ist **keine Rechtsberatung** und ersetzt keine
Prüfung durch Datenschutzfachleute. Siehe auch
[legal-checklist.md](legal-checklist.md).

## Grundprinzipien

1. **Datenminimierung**: BASIC ist der Standard und funktioniert ohne jede
   persistente Besuchererkennung.
2. **Keine erfundenen Metriken**: was ohne Wiedererkennung nicht berechenbar
   ist, wird als „nicht verfügbar" dargestellt (`null`), nicht approximiert.
3. **Einwilligung als Schalter**: pseudonyme Identifikatoren existieren nur
   im Zustand `granted` und werden bei Widerruf lokal sofort gelöscht.
4. **Kein Fingerprinting**: weder als primäre noch als Fallback-Technik.
5. **Kein versteckter Datenabfluss**: keine Telemetrie, keine externen
   Dienste, keine CDNs in der Standardinstallation.

## Consent-State-Machine

```text
        ┌──────────┐  setConsent("granted")  ┌──────────┐
        │ unknown  │ ───────────────────────▶│ granted  │
        │ (BASIC)  │                         │(CONSENTED)│
        └──────────┘ ◀─────────────────────── └──────────┘
              ▲           granted -> denied: lt_vid/lt_sid
        ┌──────────┐        sofort lokal löschen, zurück
        │ denied   │        zu BASIC, keine consented Events
        │ (BASIC)  │        mehr
        └──────────┘
```

`unknown` und `denied` sind funktional identisch: ausschließlich BASIC.

## Datenkategorien

| Feld | Zweck | Basic | Consented | Retention | Einordnung |
| --- | --- | --- | --- | --- | --- |
| `event_id` | Dedup/technische Identität | ja | ja | Rohdaten-Retention | anonym (zufällig, nicht aus Nutzerdaten ableitbar) |
| `occurred_at` | Zeitauswertung | ja | ja | Rohdaten-Retention | nicht personenbezogen |
| `page_path`, `page_title`, `hostname` | Content-Analyse | ja | ja | Rohdaten-Retention | nicht personenbezogen (Query/Fragment entfernt) |
| `referrer_host` | Herkunftsanalyse | ja | ja | Rohdaten-Retention | nicht personenbezogen |
| `referrer_path` | interne Herkunft | nur same-origin | nur same-origin | Rohdaten-Retention | nicht personenbezogen |
| `campaign_*` (UTM) | Kampagnenanalyse | ja (allowlistet) | ja | Rohdaten-Retention | nicht personenbezogen |
| `browser_family`, `browser_version_major`, `os_family`, `device_class` | Technik-Auswertung | ja | ja | Rohdaten-Retention | grob, nicht identifizierend |
| `language`, `client_timezone` | Lokalisierungsanalyse | nein | ja | Rohdaten-Retention | grob |
| `country_code` (optional) | grobe Region | nur wenn Geo aktiviert | nur wenn Geo aktiviert | Rohdaten-Retention | pseudonymisierend (Land) |
| `visitor_id` | Besucherzählung | **nie** | nach Einwilligung | Rohdaten-Retention, Löschung bei Widerruf | pseudonym |
| `session_id` | Sitzungsanalyse | **nie** | nach Einwilligung | Rohdaten-Retention, Löschung bei Widerruf | pseudonym |
| `duration_ms` | Engagement | ja | ja | Rohdaten-Retention | nicht personenbezogen |
| `properties` (JSON) | Custom Events | sanitisiert | sanitisiert | Rohdaten-Retention | Betreiber-verantwortet |
| Rollups (`analytics_hourly/daily`) | schnelle Auswertung | ja | ja | nicht zeitlich begrenzt | aggregiert, ohne Identifikatoren |
| **IP-Adresse** | — | **nie gespeichert** | **nie gespeichert** | — | nur transient |
| **Voller User-Agent** | — | **nie gespeichert** | **nie gespeichert** | — | nur transient |

## IP-Adressen

Die Quell-IP ist bei HTTP technisch unvermeidbar sichtbar. lumly nutzt
sie ausschließlich transient:

- Request-Verarbeitung
- Rate-Limiting (nur flüchtiger Arbeitsspeicher, kurze TTL)
- optionale Geo-Auflösung **vor** Persistenz (Ergebnis: Ländercode)

Sie wird niemals in Tabellen, Logs oder Exports geschrieben.

## Geo-Auswertung

Deaktiviert per Default (`GEO_ENABLED=false`). Aktivierung erfordert eine
lokal gehostete MMDB-Datei (`GEO_DB_PATH`); es werden keine externen
Geo-Dienste kontaktiert. Gespeichert wird maximal der Ländercode. Die
rechtliche Zulässigkeit ist vom Betreiber zu bewerten — die Aktivierung ist
eine bewusste Konfigurationsentscheidung.

## Löschung und Betroffenenrechte

- **Retention-Job**: löscht Rohdaten älter als `retention_days` (Default 90,
  technischer Default, keine Rechtsaussage) in 5000er-Chunks.
- **Betroffenen-Löschung**: `DELETE /api/v1/privacy/visitors/:site/:visitorId`
  entfernt alle Events einer pseudonymen `visitor_id`.
- **Export**: `GET /api/v1/privacy/visitors/:site/:visitorId/export`.
- **Clientseitig**: `tracker.forget()` entfernt lokale IDs.

Rollups enthalten keine Identifikatoren und werden bei einer
Betroffenen-Löschung nicht rückgerechnet. Das ist technisch nicht möglich,
ohne die Aggregation personenbeziehbar zu machen — und damit gewollt.

## Schutz gegen versehentliche PII

Der kanonische Sanitizer (`packages/shared/src/sanitize.ts`) verwirft:

- Property-Namen aus einer Sperrliste (email, token, password, name, iban, …)
- Werte, die wie E-Mail-Adressen, JWTs, Bearer-Tokens oder Kreditkartennummern aussehen
- alle Query-Parameter außer explizit allowlisteten
- URL-Fragmente
- nicht-primitive Property-Werte

Dies ist Tiefenverteidigung, **keine** perfekte PII-Erkennung. Betreiber
müssen Custom Events fachlich prüfen (siehe Legal-Checkliste).

## Was lumly niemals automatisch sammelt

Passwörter, Formularinhalte, Texteingaben, Namen, Adressen, Kreditkartendaten,
Clipboard, DOM-Snapshots, Session-Recordings, Maus-Replays, Tastatureingaben,
präzise GPS-Positionen, Auth-Tokens, Session-Cookies. Formulare erzeugen
höchstens das abstrakte Event `form_submit` — ohne Feldnamen und -werte.
