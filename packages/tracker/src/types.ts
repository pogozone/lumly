export type ConsentState = "unknown" | "granted" | "denied";

export type ConsentInput = ConsentState | { analytics: boolean };

export interface TrackerConfig {
  siteId: string;
  endpoint: string;
  /** Auto track page views and SPA navigation. Default true. */
  autoTrack?: boolean;
  /** Initial consent state. Default "unknown". */
  consent?: ConsentInput;
  /** Extra query parameters allowed to persist (must also be allowed server-side). */
  queryAllowlist?: string[];
  /** Flush interval in ms. Default 5000. */
  flushIntervalMs?: number;
}

export interface Tracker {
  start(): void;
  destroy(): void;
  track(name: string, properties?: Record<string, string | number | boolean | null>): void;
  pageView(path?: string): void;
  setConsent(input: ConsentInput): void;
  getConsent(): ConsentState;
  /** Remove all local analytics identifiers immediately. */
  forget(): void;
}

export interface OutgoingEvent {
  id: string;
  type: string;
  name?: string;
  mode: "basic" | "consented";
  timestamp: string;
  visitorId?: string;
  sessionId?: string;
  hostname: string;
  path: string;
  title?: string;
  referrer?: string;
  language?: string;
  timezone?: string;
  durationMs?: number;
  value?: number;
  properties?: Record<string, string | number | boolean | null>;
}
