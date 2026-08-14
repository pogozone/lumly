# Lumly – Collector/CORS-Fix

Dieser Patch behebt:

1. `OPTIONS /api/v1/collect` → 404 / CORS Missing Allow Origin
2. fehlende CORS-Header auf dem eigentlichen Collector-POST
3. Integrations-Snippets, die wegen des Default-`APP_ORIGIN` auf `http://localhost:3000` zeigen
4. Firefox-Warnungen für nicht unterstützte `PerformanceObserver`-EntryTypes wie `layout-shift`

## Enthaltene vollständige Dateien

- `apps/server/src/app.ts`
- `apps/server/src/routes/collect.ts`
- `apps/server/src/routes/sites.ts`
- `apps/server/src/tests/collect.test.ts`
- `packages/tracker/src/tracker.ts`

## Deployment

Die Dateien an denselben Pfaden im Lumly-Projekt ersetzen und Lumly neu bauen/redeployen.

Mit dem gemeinsam verwendeten `platform`-Tool:

```bash
./platform rebuild lumly
```

Danach im Lumly-Dashboard für die Site einen neuen Integrations-Snippet abrufen.
Der Collector-Endpunkt muss über die öffentliche Lumly-Adresse laufen, lokal also z. B.:

```text
http://lumly.emaz.local/api/v1/collect
```

und nicht über:

```text
http://localhost:3000/api/v1/collect
```

## Probier mein Bier

Der aktuelle Quellstand von `Probier mein Bier` enthält bereits `GET /api/bootstrap`.
Wenn die laufende Anwendung dort weiterhin 404 `Nicht gefunden` liefert, läuft ein altes Container-Image.

Neu bauen und Container erzwingen:

```bash
./platform rebuild probier-mein-bier
```

Danach prüfen:

```bash
curl -i http://probier-mein-bier.emaz.local/api/bootstrap
```

Erwartet wird HTTP 200 mit JSON.
