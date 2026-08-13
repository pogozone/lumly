export const TRACKING_MODES = ["basic", "consented"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

export const EVENT_TYPES = [
  "page_view",
  "route_change",
  "custom",
  "performance",
  "engagement",
  "scroll_depth",
  "outbound_link",
  "file_download",
  "form_submit"
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CONSENT_STATES = ["unknown", "granted", "denied"] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

/** Hard limits enforced by the collector. */
export const LIMITS = {
  maxBatchEvents: 20,
  maxBodyBytes: 64 * 1024,
  maxProperties: 20,
  maxPropertyKeyLength: 60,
  maxPropertyStringLength: 300,
  maxEventNameLength: 120,
  maxPathLength: 1024,
  maxTitleLength: 512,
  maxHostnameLength: 255,
  maxReferrerLength: 1024,
  maxCampaignParamLength: 120,
  maxEventIdLength: 40,
  maxLanguageLength: 16,
  maxTimezoneLength: 64,
  eventNamePattern: /^[a-zA-Z][a-zA-Z0-9_.:-]{0,119}$/
} as const;

/** Campaign query parameters that may be retained from URLs. */
export const CAMPAIGN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
] as const;

/**
 * Property names that are dropped unconditionally by the sanitizer.
 * This is a defence-in-depth list, not a perfect PII detector.
 */
export const SUSPICIOUS_PROPERTY_NAMES = [
  "email",
  "e-mail",
  "mail",
  "phone",
  "telephone",
  "tel",
  "mobile",
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "jwt",
  "auth",
  "authorization",
  "apikey",
  "api_key",
  "session",
  "cookie",
  "firstname",
  "first_name",
  "lastname",
  "last_name",
  "fullname",
  "full_name",
  "name",
  "username",
  "user",
  "userid",
  "user_id",
  "address",
  "street",
  "zip",
  "zipcode",
  "postal",
  "city",
  "iban",
  "bic",
  "creditcard",
  "credit_card",
  "cardnumber",
  "card_number",
  "cc",
  "cvv",
  "ssn",
  "birthdate",
  "birthday",
  "dob",
  "ip",
  "ipaddress",
  "ip_address",
  "gps",
  "lat",
  "latitude",
  "lng",
  "lon",
  "longitude",
  "geo",
  "location"
] as const;

export const DEVICE_CLASSES = ["desktop", "mobile", "tablet", "bot", "unknown"] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];
