import { EVENT_TYPES, LIMITS, TRACKING_MODES } from "./constants.js";

/** JSON Schema for POST /api/v1/collect envelope. */
export const collectEnvelopeSchema = {
  type: "object",
  required: ["site", "events"],
  additionalProperties: false,
  properties: {
    site: { type: "string", minLength: 1, maxLength: 40 },
    events: {
      type: "array",
      minItems: 1,
      maxItems: LIMITS.maxBatchEvents,
      items: {
        type: "object",
        required: ["type", "mode", "timestamp", "hostname", "path"],
        additionalProperties: false,
        properties: {
          id: { type: "string", maxLength: LIMITS.maxEventIdLength },
          type: { type: "string", enum: [...EVENT_TYPES] },
          name: { type: "string", maxLength: LIMITS.maxEventNameLength },
          mode: { type: "string", enum: [...TRACKING_MODES] },
          timestamp: { type: "string", maxLength: 40 },
          visitorId: { type: "string", maxLength: 40 },
          sessionId: { type: "string", maxLength: 40 },
          hostname: { type: "string", minLength: 1, maxLength: LIMITS.maxHostnameLength },
          path: { type: "string", minLength: 1, maxLength: LIMITS.maxPathLength + 600 },
          title: { type: "string", maxLength: LIMITS.maxTitleLength },
          referrer: { type: "string", maxLength: LIMITS.maxReferrerLength },
          language: { type: "string", maxLength: LIMITS.maxLanguageLength },
          timezone: { type: "string", maxLength: LIMITS.maxTimezoneLength },
          durationMs: { type: "number", minimum: 0 },
          value: { type: "number" },
          properties: {
            type: "object",
            maxProperties: LIMITS.maxProperties,
            additionalProperties: {
              anyOf: [
                { type: "string", maxLength: LIMITS.maxPropertyStringLength },
                { type: "number" },
                { type: "boolean" },
                { type: "null" }
              ]
            }
          }
        }
      }
    }
  }
} as const;
