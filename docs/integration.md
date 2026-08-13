# Integration

Ziel: lumly ist in wenigen Minuten integriert. Voraussetzung ist eine
angelegte Site (Dashboard → Sites) mit der Site-ID und der Origin-Allowlist.

## Klassische Webseite

```html
<script
  defer
  src="https://analytics.example.org/tracker.js"
  data-site="SITE_ID"
  data-endpoint="https://analytics.example.org/api/v1/collect">
</script>
```

Nach dem Laden wird automatisch der erste Page View erfasst (BASIC-Modus:
keine Cookies, kein Storage, keine IDs).

Optionale Attribute:

| Attribut | Bedeutung | Default |
| --- | --- | --- |
| `data-site` | Site-ID (öffentlich, kein Secret) | Pflicht |
| `data-endpoint` | Collector-URL | Origin des Script-Src + `/api/v1/collect` |
| `data-auto-track` | `"false"` deaktiviert automatische Page Views | `"true"` |
| `data-consent` | `unknown` \| `granted` \| `denied` | `unknown` |

## Consent Manager anbinden

lumly bringt bewusst **kein** Cookie-Banner mit. Der initial consent
state ist `unknown` (= BASIC). Beispiel für einen bestehenden CMP-Hook:

```js
// Pseudocode: an die API des eigenen Consent Managers anpassen
cmp.onConsentChange(function (consents) {
  window.lumly.setConsent({ analytics: consents.analytics === true });
});
```

oder direkt:

```js
window.lumly.setConsent("granted");  // erzeugt pseudonyme IDs
window.lumly.setConsent("denied");   // löscht lokale IDs sofort, zurück zu BASIC
window.lumly.setConsent("unknown");  // wie denied
```

Widerruf plus clientseitige Löschung:

```js
window.lumly.setConsent("denied");
window.lumly.forget(); // entfernt lt_vid / lt_sid aus dem Browser
```

Serverseitige Löschung bereits gespeicherter pseudonymer Daten: Dashboard →
Privacy → Betroffenen-Löschung (oder `DELETE /api/v1/privacy/visitors/:site/:visitorId`).

## Custom Events

```js
window.lumly.track("cta_click", { placement: "hero", variant: "blue" });
```

Regeln: Event-Name `[a-zA-Z][a-zA-Z0-9_.:-]{0,119}`, max. 20 Properties,
nur `string | number | boolean | null`. Details: [custom-events.md](custom-events.md).

## React

```tsx
import { useEffect } from "react";
import { createTracker, type Tracker } from "@lumly/browser";

let tracker: Tracker | null = null;

export function uselumly() {
  useEffect(() => {
    tracker = createTracker({
      siteId: "SITE_ID",
      endpoint: "https://analytics.example.org/api/v1/collect"
    });
    tracker.start();
    return () => tracker?.destroy();
  }, []);
  return tracker;
}
```

SPA-Navigation (React Router etc.) wird über `history.pushState` /
`popstate` automatisch erkannt; doppelte Page Views werden unterdrückt.

## Next.js (App Router)

```tsx
// app/providers.tsx
"use client";
import { useEffect } from "react";
import { createTracker } from "@lumly/browser";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const t = createTracker({
      siteId: process.env.NEXT_PUBLIC_LEANTRACK_SITE!,
      endpoint: "https://analytics.example.org/api/v1/collect"
    });
    t.start();
    return () => t.destroy();
  }, []);
  return children;
}
```

```tsx
// app/layout.tsx
import { AnalyticsProvider } from "./providers";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body><AnalyticsProvider>{children}</AnalyticsProvider></body></html>
  );
}
```

## Vue

```js
// main.js
import { createTracker } from "@lumly/browser";
const tracker = createTracker({ siteId: "SITE_ID", endpoint: "https://analytics.example.org/api/v1/collect" });
tracker.start();
app.config.globalProperties.$lt = tracker;
```

## Serverseitig gerenderte Anwendungen

Script-Tag wie bei klassischen Webseiten. Der Tracker läuft vollständig im
Browser; SSR erfordert keine Anpassung.

## Content Security Policy

Für die integrierende Seite notwendig:

```text
script-src  https://analytics.example.org
connect-src https://analytics.example.org
```

(`img-src` o. ä. ist nicht nötig — kein Tracking-Pixel.)

## Fehlerverhalten

Der Tracker fängt alle internen Fehler ab. Ein Ausfall der Analytics hat
keinerlei Auswirkung auf die Host-Anwendung (kein Throw, kein Blocking,
kein `console.log` in Production).
