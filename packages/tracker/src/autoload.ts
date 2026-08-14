import { createTracker } from "./tracker.js";
import type { ConsentState, Tracker } from "./types.js";

/**
 * Script-tag bootstrap. Reads configuration from data-* attributes of the
 * current script tag and exposes a minimal global API as `window.lumly`.
 */
(function bootstrap(): void {
  try {
    const script =
      document.currentScript ??
      (() => {
        const scripts = document.querySelectorAll("script[data-site]");
        return scripts.length ? scripts[scripts.length - 1] : null;
      })();
    if (!script) return;

    const siteId = script.getAttribute("data-site");
    if (!siteId) return;
    const scriptUrl = new URL(script.getAttribute("src") ?? "./tracker.js", location.href);
    const endpoint =
      script.getAttribute("data-endpoint") ??
      new URL("api/v1/collect", new URL("./", scriptUrl)).toString();
    const autoTrack = script.getAttribute("data-auto-track") !== "false";
    const consent = (script.getAttribute("data-consent") ?? "unknown") as ConsentState;

    const tracker: Tracker = createTracker({ siteId, endpoint, autoTrack, consent });
    tracker.start();

    // Minimal global, kept deliberately small to avoid namespace pollution.
    (window as unknown as { lumly: Tracker }).lumly = tracker;
  } catch {
    /* tracker must never break its host */
  }
})();
