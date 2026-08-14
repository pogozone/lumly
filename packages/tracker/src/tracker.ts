import type { ConsentInput, ConsentState, OutgoingEvent, Tracker, TrackerConfig } from "./types.js";

const VID_KEY = "lt_vid";
const SID_KEY = "lt_sid";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_BATCH = 20;
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const DOWNLOAD_EXT = /\.(pdf|zip|gz|tar|dmg|exe|msi|apk|csv|xlsx?|docx?|pptx?|mp[34]|avi|mov)(\?|$)/i;

function randomId(): string {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(36).padStart(2, "0").slice(-2);
  return out.slice(0, 26);
}

function normalizeConsent(input: ConsentInput): ConsentState {
  if (typeof input === "string") {
    return input === "granted" || input === "denied" ? input : "unknown";
  }
  if (input && typeof input === "object") return input.analytics === true ? "granted" : "denied";
  return "unknown";
}

/** Strip fragment and all non-allowlisted query parameters client-side. */
function cleanPath(extraAllow: string[]): string {
  const loc = location;
  const allowed = new Set([...CAMPAIGN_PARAMS, ...extraAllow]);
  const kept: string[] = [];
  try {
    const params = new URLSearchParams(loc.search);
    params.forEach((value, key) => {
      if (allowed.has(key.toLowerCase()) && value.length <= 120) {
        kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });
  } catch {
    /* ignore */
  }
  let p = loc.pathname || "/";
  if (kept.length) p += `?${kept.join("&")}`;
  return p.slice(0, 1024);
}

function viewportBucket(): string {
  const w = window.innerWidth || 0;
  return w < 576 ? "s" : w < 992 ? "m" : w < 1400 ? "l" : "xl";
}

export function createTracker(config: TrackerConfig): Tracker {
  let consent: ConsentState = normalizeConsent(config.consent ?? "unknown");
  let started = false;
  let destroyed = false;
  const queue: OutgoingEvent[] = [];
  const extraAllow = config.queryAllowlist ?? [];
  const flushIntervalMs = config.flushIntervalMs ?? 5000;
  let flushTimer: number | undefined;
  let lastPageKey = "";
  let lastPageAt = 0;
  let engagedMs = 0;
  let engagedSince: number | null = null;
  const scrollHit = new Set<number>();
  let perfSent = false;
  let clsValue = 0;
  let lcpMs: number | null = null;
  let fcpMs: number | null = null;
  let inpMs: number | null = null;

  // --- storage (CONSENTED mode only) ---
  function storageGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function storageSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: run session-less, never fall back to fingerprinting */
    }
  }
  function storageRemove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  function getVisitorId(): string | undefined {
    if (consent !== "granted") return undefined;
    let id = storageGet(VID_KEY);
    if (!id) {
      id = randomId();
      storageSet(VID_KEY, id);
    }
    return id;
  }

  function getSessionId(): string | undefined {
    if (consent !== "granted") return undefined;
    try {
      const raw = storageGet(SID_KEY);
      const now = Date.now();
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; exp?: number };
        if (parsed.id && typeof parsed.exp === "number" && parsed.exp > now) {
          storageSet(SID_KEY, JSON.stringify({ id: parsed.id, exp: now + SESSION_TTL_MS }));
          return parsed.id;
        }
      }
      const id = randomId();
      storageSet(SID_KEY, JSON.stringify({ id, exp: now + SESSION_TTL_MS }));
      return id;
    } catch {
      return undefined;
    }
  }

  // --- transport ---
  function send(events: OutgoingEvent[], useBeacon: boolean): void {
    if (events.length === 0) return;
    const body = JSON.stringify({ site: config.siteId, events });
    try {
      if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
        if (navigator.sendBeacon(config.endpoint, new Blob([body], { type: "application/json" }))) return;
      }
      void fetch(config.endpoint, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        credentials: "omit"
      }).catch(() => {});
    } catch {
      /* tracking failure must be invisible to the host */
    }
  }

  function flush(useBeacon = false): void {
    while (queue.length > 0) {
      send(queue.splice(0, MAX_BATCH), useBeacon);
    }
  }

  function enqueue(ev: OutgoingEvent): void {
    if (destroyed) return;
    queue.push(ev);
    if (queue.length >= MAX_BATCH) flush();
  }

  function baseEvent(type: string): OutgoingEvent {
    const mode = consent === "granted" ? "consented" : "basic";
    const ev: OutgoingEvent = {
      id: randomId(),
      type,
      mode,
      timestamp: new Date().toISOString(),
      hostname: location.hostname,
      path: cleanPath(extraAllow)
    };
    if (mode === "consented") {
      const vid = getVisitorId();
      const sid = getSessionId();
      if (vid) ev.visitorId = vid;
      if (sid) ev.sessionId = sid;
    }
    return ev;
  }

  // --- page views / SPA ---
  function sendPageView(type: "page_view" | "route_change"): void {
    const key = cleanPath(extraAllow);
    const now = Date.now();
    if (key === lastPageKey && now - lastPageAt < 300) return; // dedupe
    lastPageKey = key;
    lastPageAt = now;
    const ev = baseEvent(type);
    ev.title = (document.title || "").slice(0, 512) || undefined;
    try {
      if (document.referrer) ev.referrer = document.referrer.slice(0, 1024);
    } catch {
      /* ignore */
    }
    ev.properties = { viewport: viewportBucket() };
    if (consent === "granted") {
      if (navigator.language) ev.language = navigator.language.slice(0, 16);
      try {
        ev.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0, 64);
      } catch {
        /* ignore */
      }
    }
    enqueue(ev);
    resetEngagement();
  }

  function patchHistory(): () => void {
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    const onNav = () => {
      setTimeout(() => {
        try {
          sendPageView("route_change");
        } catch {
          /* ignore */
        }
      }, 0);
    };
    history.pushState = function (...args) {
      const r = origPush.apply(this, args);
      onNav();
      return r;
    };
    history.replaceState = function (...args) {
      const r = origReplace.apply(this, args);
      onNav();
      return r;
    };
    window.addEventListener("popstate", onNav);
    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", onNav);
    };
  }

  // --- engagement ---
  function resetEngagement(): void {
    engagedMs = 0;
    engagedSince = document.visibilityState === "visible" ? Date.now() : null;
    scrollHit.clear();
    perfSent = false;
    clsValue = 0;
    lcpMs = null;
    fcpMs = null;
    inpMs = null;
  }

  function currentEngagement(): number {
    const extra = engagedSince !== null ? Date.now() - engagedSince : 0;
    return engagedMs + extra;
  }

  function onVisibility(): void {
    try {
      if (document.visibilityState === "hidden") {
        if (engagedSince !== null) {
          engagedMs += Date.now() - engagedSince;
          engagedSince = null;
        }
        sendEngagement();
        sendPerformance();
        flush(true);
      } else if (engagedSince === null) {
        engagedSince = Date.now();
      }
    } catch {
      /* ignore */
    }
  }

  function sendEngagement(): void {
    const ms = currentEngagement();
    if (ms < 500) return;
    const ev = baseEvent("engagement");
    ev.durationMs = ms;
    enqueue(ev);
    engagedMs = 0;
    engagedSince = document.visibilityState === "visible" ? Date.now() : null;
  }

  function onScroll(): void {
    try {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.min(100, Math.round(((window.scrollY || 0) / max) * 100));
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !scrollHit.has(m)) {
          scrollHit.add(m);
          const ev = baseEvent("scroll_depth");
          ev.value = m;
          enqueue(ev);
        }
      }
    } catch {
      /* ignore */
    }
  }

  // --- links / forms ---
  function onClick(e: MouseEvent): void {
    try {
      const el = (e.target as Element | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href") || "";
      if (DOWNLOAD_EXT.test(href)) {
        const ev = baseEvent("file_download");
        // Only the file name, never a full URL with parameters.
        const file = href.split("/").pop()?.split("?")[0]?.slice(0, 200);
        ev.properties = { file: file || "unknown" };
        enqueue(ev);
        return;
      }
      let url: URL | null = null;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.hostname && url.hostname !== location.hostname && /^https?:$/.test(url.protocol)) {
        const ev = baseEvent("outbound_link");
        ev.properties = { target_host: url.hostname.slice(0, 255) };
        enqueue(ev);
      }
    } catch {
      /* ignore */
    }
  }

  function onSubmit(): void {
    try {
      // Abstract event only. Field names and values are never collected.
      enqueue(baseEvent("form_submit"));
    } catch {
      /* ignore */
    }
  }

  // --- performance ---
  function observePerformance(): void {
    try {
      if (typeof PerformanceObserver === "undefined") return;
      const po = new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries()) {
            if (entry.entryType === "largest-contentful-paint") {
              lcpMs = Math.round(entry.startTime);
            } else if (entry.entryType === "paint" && entry.name === "first-contentful-paint") {
              fcpMs = Math.round(entry.startTime);
            } else if (entry.entryType === "layout-shift") {
              const ls = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
              if (!ls.hadRecentInput && typeof ls.value === "number") clsValue += ls.value;
            } else if (entry.entryType === "event") {
              const et = entry as PerformanceEntry & { duration?: number; interactionId?: number };
              if (et.interactionId && et.duration && et.duration > (inpMs ?? 0)) {
                inpMs = Math.round(et.duration);
              }
            }
          }
        } catch {
          /* ignore */
        }
      });
      const supported = Array.isArray(PerformanceObserver.supportedEntryTypes)
        ? new Set(PerformanceObserver.supportedEntryTypes)
        : null;
      const canObserve = (type: string) => supported === null || supported.has(type);

      if (canObserve("largest-contentful-paint")) {
        po.observe({ type: "largest-contentful-paint", buffered: true });
      }
      if (canObserve("paint")) {
        po.observe({ type: "paint", buffered: true });
      }
      if (canObserve("layout-shift")) {
        po.observe({ type: "layout-shift", buffered: true });
      }
      if (canObserve("event")) {
        try {
          po.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
        } catch {
          /* event timing unsupported */
        }
      }
    } catch {
      /* performance APIs unavailable: never an error */
    }
  }

  function sendPerformance(): void {
    if (perfSent) return;
    perfSent = true;
    try {
      const props: Record<string, number> = {};
      const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        if (nav.responseStart > 0) props.ttfb_ms = Math.round(nav.responseStart);
        if (nav.domContentLoadedEventEnd > 0) props.dcl_ms = Math.round(nav.domContentLoadedEventEnd);
        if (nav.loadEventEnd > 0) props.load_ms = Math.round(nav.loadEventEnd);
      }
      if (fcpMs !== null) props.fcp_ms = fcpMs;
      if (lcpMs !== null) props.lcp_ms = lcpMs;
      if (inpMs !== null) props.inp_ms = inpMs;
      if (Object.keys(props).length === 0 && clsValue === 0) return;
      const ev = baseEvent("performance");
      ev.properties = { ...props, cls: Math.round(clsValue * 10000) / 10000 };
      enqueue(ev);
    } catch {
      /* ignore */
    }
  }

  let cleanupHistory: (() => void) | null = null;
  const scrollHandler = { t: 0 } as { t: number };
  function throttledScroll(): void {
    const now = Date.now();
    if (now - scrollHandler.t < 500) return;
    scrollHandler.t = now;
    onScroll();
  }

  return {
    start(): void {
      if (started || destroyed) return;
      started = true;
      try {
        if (config.autoTrack !== false) {
          cleanupHistory = patchHistory();
          sendPageView("page_view");
        }
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onVisibility);
        window.addEventListener("scroll", throttledScroll, { passive: true });
        document.addEventListener("click", onClick, true);
        document.addEventListener("submit", onSubmit, true);
        observePerformance();
        resetEngagement();
        flushTimer = window.setInterval(() => {
          try {
            flush();
          } catch {
            /* ignore */
          }
        }, flushIntervalMs);
      } catch {
        /* tracker must never break its host */
      }
    },

    destroy(): void {
      destroyed = true;
      try {
        if (flushTimer !== undefined) clearInterval(flushTimer);
        cleanupHistory?.();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", onVisibility);
        window.removeEventListener("scroll", throttledScroll);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("submit", onSubmit, true);
        flush(true);
      } catch {
        /* ignore */
      }
    },

    track(name, properties) {
      try {
        if (typeof name !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.:-]{0,119}$/.test(name)) return;
        const ev = baseEvent("custom");
        ev.name = name;
        if (properties && typeof properties === "object" && !Array.isArray(properties)) {
          const clean: Record<string, string | number | boolean | null> = {};
          let n = 0;
          for (const [k, v] of Object.entries(properties)) {
            if (++n > 20) break;
            const t = typeof v;
            if (v === null) clean[k.slice(0, 60)] = null;
            else if (t === "string") clean[k.slice(0, 60)] = (v as string).slice(0, 300);
            else if (t === "number" && Number.isFinite(v)) clean[k.slice(0, 60)] = v as number;
            else if (t === "boolean") clean[k.slice(0, 60)] = v as boolean;
          }
          ev.properties = clean;
        }
        enqueue(ev);
      } catch {
        /* ignore */
      }
    },

    pageView(path?: string) {
      try {
        sendPageView("page_view");
        void path; // custom path display is not supported client-side for safety
      } catch {
        /* ignore */
      }
    },

    setConsent(input: ConsentInput) {
      try {
        const next = normalizeConsent(input);
        const prev = consent;
        consent = next;
        if (prev !== "granted" && next === "granted") {
          // unknown/denied -> granted: IDs are created lazily with next event.
          getVisitorId();
          getSessionId();
        } else if (prev === "granted" && next !== "granted") {
          // granted -> denied/unknown: stop consented tracking, remove IDs.
          storageRemove(VID_KEY);
          storageRemove(SID_KEY);
        }
      } catch {
        /* ignore */
      }
    },

    getConsent() {
      return consent;
    },

    forget() {
      try {
        storageRemove(VID_KEY);
        storageRemove(SID_KEY);
      } catch {
        /* ignore */
      }
    }
  };
}
