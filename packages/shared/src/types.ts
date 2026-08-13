import type { DeviceClass, EventType, TrackingMode } from "./constants.js";

export interface Site {
  id: string;
  name: string;
  domain: string;
  allowedOrigins: string[];
  timezone: string;
  retentionDays: number;
  geoEnabled: boolean;
  defaultTrackingMode: TrackingMode;
  queryAllowlist: string[];
  createdAt: string;
}

/** Event payload as sent by the tracker (pre-sanitization). */
export interface IncomingEvent {
  id?: string;
  type: EventType;
  name?: string;
  mode: TrackingMode;
  timestamp: string;
  visitorId?: string;
  sessionId?: string;
  hostname: string;
  path: string;
  title?: string;
  referrer?: string;
  durationMs?: number;
  value?: number;
  properties?: Record<string, unknown>;
}

export interface CollectEnvelope {
  site: string;
  events: IncomingEvent[];
}

/** Event after canonical sanitization, ready for persistence. */
export interface SanitizedEvent {
  eventId: string;
  type: EventType;
  name: string | null;
  mode: TrackingMode;
  occurredAt: Date;
  visitorId: string | null;
  sessionId: string | null;
  hostname: string;
  pagePath: string;
  pageTitle: string | null;
  referrerHost: string | null;
  referrerPath: string | null;
  campaignSource: string | null;
  campaignMedium: string | null;
  campaignName: string | null;
  campaignContent: string | null;
  campaignTerm: string | null;
  language: string | null;
  timezone: string | null;
  durationMs: number | null;
  numericValue: number | null;
  properties: Record<string, string | number | boolean | null> | null;
}

export interface StoredEvent extends SanitizedEvent {
  browserFamily: string | null;
  browserVersionMajor: number | null;
  osFamily: string | null;
  deviceClass: DeviceClass | null;
  countryCode: string | null;
  regionCode: string | null;
  isBot: boolean;
}

export type Primitive = string | number | boolean | null;

export interface DateRange {
  from: string; // ISO 8601
  to: string; // ISO 8601
}

export interface AnalyticsFilters extends DateRange {
  site: string;
  mode?: TrackingMode | "all";
  path?: string;
  eventName?: string;
  referrer?: string;
  campaign?: string;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  includeBots?: boolean;
}

export interface KpiSet {
  pageViews: number;
  events: number;
  basicPageViews: number;
  consentedPageViews: number;
  /** null when not computable without persistent recognition. */
  visitors: number | null;
  /** null when not computable without persistent recognition. */
  sessions: number | null;
  avgEngagementMs: number | null;
  consentRate: number | null;
}

export interface TimeSeriesPoint {
  bucket: string;
  pageViews: number;
  events: number;
  visitors: number | null;
  sessions: number | null;
}

export interface CompareResult<T> {
  current: T;
  previous: T | null;
}

export interface FunnelStep {
  type: "page" | "event";
  value: string;
}

export interface FunnelDefinition {
  id: number;
  siteId: string;
  name: string;
  steps: FunnelStep[];
  createdAt: string;
}

export interface FunnelStepResult {
  step: FunnelStep;
  count: number;
  conversionFromPrevious: number | null;
}
