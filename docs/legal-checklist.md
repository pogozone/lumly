# Legal Checklist (Betreiber-Verantwortung)

lumly ist technisch so gebaut, dass datenschutzfreundliche Konfiguration
erzwungen wird. Ob eine konkrete Installation rechtlich zulässig ist, hängt
vom Betreiber ab. Diese Liste enthält **keine** juristischen Garantien und
keine Rechtsberatung.

## Vor dem produktiven Betrieb

- [ ] **Verarbeitungszweck definiert** — Was genau soll mit den Analytics
      beantwortet werden?
- [ ] **Rechtsgrundlage geprüft** — z. B. berechtigtes Interesse vs.
      Einwilligung; Bewertung dokumentiert.
- [ ] **Consent-Frage geklärt** — TDDDG: Ist für den gewählten Modus eine
      Einwilligung erforderlich? CONSENTED-Tracking darf erst nach
      `granted` laufen.
- [ ] **Consent Manager angebunden** — `setConsent` korrekt verdrahtet,
      Widerruf getestet (lokale IDs werden gelöscht?).
- [ ] **Datenschutzerklärung ergänzt** — eingesetztes Tool, Zwecke,
      Datenkategorien, Speicherdauer, Widerrufsmöglichkeit.
- [ ] **Retention festgelegt** — `retention_days` pro Site ist eine
      *technische* Voreinstellung; die rechtlich zulässige Speicherdauer
      muss der Betreiber selbst bestimmen.
- [ ] **Geo-Auswertung bewertet** — `GEO_ENABLED` nur aktivieren nach
      eigener rechtlicher Prüfung.
- [ ] **Hosting-Standort dokumentiert** — Server/DB-Standort, ggf.
      Drittlandtransfer-Themen.
- [ ] **Auftragsverarbeitung geprüft** — erforderlich, wenn lumly für
      Kundenseiten betrieben wird?
- [ ] **Betroffenenrechte organisatorisch geklärt** — Prozess für
      Auskunft/Löschung pseudonymer `visitor_id`-Daten (Privacy-API).
- [ ] **Custom Events auf PII geprüft** — keine E-Mails, Namen, IDs o. ä.
      in `track()`-Properties. Der Sanitizer ist nur Tiefenverteidigung.
- [ ] **Query-Allowlist geprüft** — zusätzlich erlaubte URL-Parameter
      dürfen keine personenbezogenen Daten transportieren.
- [ ] **Zugriff aufs Dashboard abgesichert** — starke Passwörter,
      HTTPS, kein Default-Passwort (existiert nicht), `ADMIN_SETUP_TOKEN`
      nach Setup entfernen.
- [ ] **Verzeichnis von Verarbeitungstätigkeiten aktualisiert** (Art. 30).

## Aussagen, die Sie NICHT machen sollten

- „lumly ist garantiert DSGVO-konform." — Die Rechtmäßigkeit hängt von
  Zweck, Konfiguration, Rechtsgrundlage und Dokumentation ab.
- „Cookieless bedeutet automatisch einwilligungsfrei." — Auch ohne Cookies
  können Einwilligungspflichten bestehen; die Bewertung obliegt dem Betreiber.
- „Der Sanitizer erkennt alle personenbezogenen Daten." — Er ist eine
  zusätzliche Schutzschicht, keine vollständige PII-Erkennung.
- „Bot-Erkennung ist zuverlässig." — Sie basiert auf UA-Heuristiken und ist
  best effort.

## Bei Zweifeln

Lassen Sie die Konfiguration durch Datenschutzfachleute oder
-Rechtsanwält:innen prüfen.
