# Custom Events

```ts
tracker.track("signup_started", { source: "pricing" });
```

## Regeln (serverseitig erzwungen)

- **Name**: `[a-zA-Z][a-zA-Z0-9_.:-]{0,119}` — beginnt mit Buchstaben,
  max. 120 Zeichen.
- **Properties**: flaches Objekt, max. 20 Einträge, Keys max. 60 Zeichen,
  nur `string | number | boolean | null`, Strings max. 300 Zeichen.
- Verschachtelte Objekte/Arrays werden abgelehnt (kein unbeschränktes JSON).
- Gesamtgröße: max. 20 Events pro Batch, max. 64 kB Request.

## Hygiene

- Namen aus der Sperrliste (z. B. `email`, `token`, `password`, `name`,
  `iban`, `ip`) sind nicht erlaubt.
- Property-Keys aus der Sperrliste und Werte, die wie E-Mails, JWTs,
  Bearer-Tokens oder Kreditkarten aussehen, werden serverseitig verworfen.
- Der Sanitizer ist Tiefenverteidigung, keine Garantie. Prüfen Sie Ihre
  Custom Events fachlich auf personenbezogene Daten.

## Gute Beispiele

```ts
tracker.track("cta_click", { placement: "hero", variant: "blue" });
tracker.track("video_progress", { video: "produkt-demo", pct: 50 });
tracker.track("plan_selected", { plan: "pro", annual: true });
tracker.track("purchase_completed", { plan: "pro" }); // ohne Beträge mit Personenbezug
```

## Schlechte Beispiele (werden verworfen/abgelehnt)

```ts
tracker.track("signup", { email: "max@example.org" });        // Key verworfen
tracker.track("login", { token: "eyJhbG..." });               // Key verworfen
tracker.track("order", { note: "Kunde max@example.org" });    // Wert verworfen
tracker.track("profile", { address: { street: "..." } });     // Event abgelehnt (Objekt)
```

## Auswertung

Dashboard → Events: Häufigkeit, Entwicklung im Zeitverlauf und (mit gesetztem
`?event=`-Filter) vorkommende Property-Keys. CSV-Export verfügbar.
