# AGENTS.md

# lumly Agent Instructions

This repository contains lumly, a privacy-first, self-hosted web analytics application.

This file defines mandatory rules for AI coding agents working on the repository.

These rules take precedence over convenience, speculative features, and refactoring preferences.

---

## 1. Mission

lumly should provide useful web analytics while collecting as little identifying information as possible.

The product has two tracking modes:

- `basic`
- `consented`

The distinction between these modes is a core architectural invariant.

Do not weaken it.

---

## 2. Core privacy invariant

BASIC tracking must never create persistent visitor recognition.

In BASIC mode do not:

- set analytics cookies
- write analytics identifiers to `localStorage`
- write analytics identifiers to `sessionStorage`
- use IndexedDB for tracking
- create visitor IDs
- create session IDs
- fingerprint browsers
- hash IP addresses into identifiers
- combine IP and User-Agent into identifiers
- attempt probabilistic visitor recognition
- perform cross-site tracking

If a metric cannot be calculated without persistent visitor recognition, do not invent an approximation.

For example, BASIC data alone cannot reliably provide:

- unique visitors
- sessions
- returning visitors
- user retention

Represent such metrics as unavailable rather than guessing.

---

## 3. CONSENTED invariant

Persistent analytics identifiers may only be created after analytics consent has explicitly entered the `granted` state.

Allowed transition:

```text
unknown -> granted
```

Only after this transition may the tracker create:

```text
visitor_id
session_id
```

On:

```text
granted -> denied
```

the tracker must immediately:

1. stop consented tracking
2. remove local analytics identifiers
3. switch to BASIC
4. prevent subsequent consent-only events

Privacy state transitions require automated tests.

---

## 4. Never use fingerprinting

Fingerprinting is prohibited.

Do not implement:

- Canvas fingerprints
- WebGL fingerprints
- Audio fingerprints
- font enumeration fingerprints
- hardware fingerprints
- persistent screen/device signatures
- IP + User-Agent signatures
- probabilistic visitor matching

Do not add these techniques even as a fallback.

---

## 5. Personal data

Do not intentionally collect raw personal data through analytics events.

Never automatically collect:

- names
- email addresses
- phone numbers
- postal addresses
- passwords
- authentication tokens
- JWTs
- cookies
- form values
- typed text
- clipboard contents
- credit card information
- complete DOM snapshots
- session recordings
- precise GPS coordinates

Custom event properties must always pass through the server-side sanitizer.

---

## 6. IP addresses

The server inevitably receives the source IP as part of the network request.

The analytics application must not persist the raw IP address.

Do not put IP addresses into:

- MariaDB
- application logs
- analytics events
- debug output
- CSV exports

Transient use for request processing or rate limiting must not turn into persistent analytics data.

If coarse GeoIP processing is enabled, perform it before persistence and store only the configured coarse result.

---

## 7. User-Agent

Do not persist the complete User-Agent unless a future requirement has been explicitly reviewed.

Prefer deriving coarse fields such as:

```text
browser_family
browser_major_version
os_family
device_class
```

Discard the raw value afterward.

---

## 8. URLs

Never blindly persist complete URLs.

Strip:

- URL fragments
- unknown query parameters
- authentication data
- tokens

Only explicitly allowlisted campaign parameters may be retained.

Always pass URLs through the URL sanitizer before database insertion.

Do not assume query parameters contain harmless data.

---

## 9. Forms

Never automatically serialize forms.

A form interaction may generate an abstract event such as:

```text
form_submit
```

but must not contain form values.

Do not add generic form serialization utilities to the tracker.

---

## 10. Architecture

Preferred repository structure:

```text
apps/server
apps/dashboard
packages/tracker
packages/shared
migrations
docs
tests
```

The production architecture should remain simple:

```text
browser
  -> lumly server
      -> MariaDB
```

Do not introduce infrastructure unless there is a demonstrated need.

Avoid adding:

- Redis
- Kafka
- Elasticsearch
- external queues
- Kubernetes requirements
- additional databases

without a documented architectural reason.

---

## 11. Database

MariaDB is the primary datastore.

Use typed columns for common analytics dimensions.

Use JSON only for bounded custom event properties.

Do not turn the entire event schema into an unstructured JSON blob.

Database migrations are append-only after they have been released.

Never silently edit an already deployed migration.

Create a new migration instead.

All SQL using user-controlled values must be parameterized.

---

## 12. Event model

Every event should have an explicit tracking mode:

```text
basic
consented
```

The database must enforce or validate that BASIC events cannot contain:

```text
visitor_id
session_id
```

Prefer defense in depth:

1. tracker validation
2. collector validation
3. service validation
4. database constraints where practical

---

## 13. Event IDs

Event IDs exist for technical event identity and deduplication.

They must not be reused as visitor identifiers.

Generate them randomly.

Do not derive them from browser or user characteristics.

---

## 14. Collector

The public collector endpoint is:

```text
POST /api/v1/collect
```

Treat everything reaching it as hostile input.

Required protections:

- schema validation
- payload size limit
- batch size limit
- allowed-origin validation
- event-name validation
- property limits
- string limits
- sanitizer
- rate limiting
- parameterized database operations

A public site ID is not a secret.

Never implement security that depends on hiding a site ID inside browser JavaScript.

---

## 15. Tracker bundle

The browser tracker must remain small.

Preferred target:

```text
<= 8 kB gzip
```

Maximum target:

```text
<= 12 kB gzip
```

Do not add a runtime dependency to the tracker unless absolutely necessary.

The tracker must not depend on:

- React
- Vue
- jQuery
- a general HTTP library
- a date library
- a state-management framework

Use browser APIs.

---

## 16. Host application safety

The analytics SDK is a guest inside another application.

It must never break its host.

Therefore:

- catch internal tracker errors
- never throw from passive tracking hooks
- never block navigation
- never intercept application events destructively
- avoid global namespace pollution
- remove listeners during cleanup
- avoid monkey patches unless unavoidable
- preserve original History API behavior

Tracking failure must be invisible to normal application functionality.

---

## 17. SPA navigation

SPA tracking may observe:

```text
history.pushState
history.replaceState
popstate
```

Preserve native behavior.

Prevent duplicate page views.

Do not introduce framework-specific assumptions into the core tracker.

---

## 18. Consent integration

lumly is not a Consent Management Platform.

Do not build a proprietary cookie banner into the core tracker.

Expose a clean API through which the host application can communicate analytics consent.

Example:

```ts
tracker.setConsent("granted");
tracker.setConsent("denied");
```

The initial state is:

```text
unknown
```

Treat `unknown` as non-consented.

---

## 19. Sanitization

All events must pass through one canonical sanitization pipeline.

Do not implement inconsistent one-off sanitizers in individual routes.

Sanitization should cover at least:

- URLs
- query parameters
- custom property names
- custom property values
- excessive string lengths
- excessive nesting
- suspected email addresses
- suspected JWTs
- authorization strings
- control characters

Tests must cover sanitization behavior.

---

## 20. Custom events

Custom events are useful, but must remain bounded.

Enforce:

- event-name length limit
- event-name format
- property-count limit
- property-key length
- property-string length
- maximum payload size
- shallow or tightly bounded nesting

Never accept arbitrary multi-megabyte JSON structures.

---

## 21. Analytics correctness

Do not manufacture metrics.

Examples:

A `unique visitor` requires a valid visitor concept.

A `session` requires a valid session concept.

A BASIC page view does not magically become a visitor because it came from the same IP address.

When data is insufficient:

```text
return null
```

or clearly mark the metric as unavailable.

Incorrect analytics are worse than missing analytics.

---

## 22. Aggregation

Use raw events for short-term detailed analysis.

Use hourly/daily rollups for recurring dashboard queries.

Aggregated analytics must not contain:

```text
visitor_id
session_id
IP
raw User-Agent
```

Avoid precomputing every possible dimension combination.

Add rollups based on demonstrated dashboard requirements.

---

## 23. Retention

Raw event retention is configurable.

Deletion jobs must operate in bounded chunks.

Avoid huge blocking deletes.

Do not interpret the configured number of retention days as a legal guarantee.

Documentation must distinguish technical defaults from the operator's legal retention decision.

---

## 24. Dashboard API

Administrative API endpoints require authentication.

Collector endpoints do not share dashboard authentication.

Keep public and private routes visibly separated.

Example:

```text
/api/v1/collect

/api/v1/auth/*
/api/v1/sites/*
/api/v1/analytics/*
/api/v1/privacy/*
```

---

## 25. Authentication

Dashboard credentials must be handled securely.

Requirements:

- Argon2id password hashes
- HttpOnly cookies
- Secure cookies in production
- SameSite protection
- CSRF protection for state-changing operations
- login rate limiting
- explicit logout

Do not store admin access tokens in localStorage.

Never ship a default production password.

---

## 26. Logging

Production logs must remain privacy-conscious.

Do not log:

- collector payloads
- IP addresses
- cookies
- Authorization headers
- visitor IDs
- session IDs
- personal event properties

Use request IDs for debugging.

Prefer metadata such as:

```text
request_id
status
route
duration
error_code
```

---

## 27. Error handling

Client-facing errors must not expose:

- SQL
- stack traces
- filesystem paths
- environment variables
- secrets

Internal errors should carry a request ID for correlation.

---

## 28. Frontend

The dashboard should be:

- fast
- readable
- responsive
- keyboard accessible
- data-focused

Avoid unnecessary UI frameworks.

Prefer reusable local components over large design-system dependencies.

Do not sacrifice tracker size because of dashboard dependencies. They are separate bundles.

---

## 29. Charts

Use the lightest solution that satisfies the requirement.

For simple visualizations prefer:

- SVG
- Canvas
- CSS

before adding a large charting framework.

Charts must gracefully handle:

- zero values
- missing values
- sparse series
- long labels
- mobile layouts
- BASIC metrics that are unavailable

---

## 30. Extensibility

Analytics views must be modular.

Do not build a single giant analytics service or dashboard component.

A new analytics module should have an obvious home for:

```text
query
response type
route
view
tests
```

Shared filters and date handling belong in shared infrastructure.

Module-specific business logic belongs in the module.

---

## 31. Dependencies

Before adding a dependency:

1. check whether the repository already provides the functionality
2. check whether the platform provides it natively
3. consider bundle/runtime cost
4. consider maintenance cost
5. consider privacy implications

Do not add packages for trivial helpers.

Never introduce third-party telemetry through a dependency.

---

## 32. External resources

The default product must work without requests to external services.

Do not silently add:

- Google Fonts
- Google Analytics
- CDN-hosted JavaScript
- externally hosted icons
- remote error reporting
- product telemetry

Bundle required frontend assets locally.

---

## 33. Tests are mandatory

Every behavioral change requires appropriate tests.

Privacy-sensitive changes require explicit privacy tests.

Before considering work complete, run the repository equivalents of:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If database integration is affected, also run integration tests against MariaDB.

Do not declare success when relevant tests are failing.

---

## 34. Privacy tests are blockers

The following are release-blocking behaviors:

```text
BASIC sets a tracking cookie
BASIC creates visitor_id
BASIC creates session_id
BASIC stores an IP
BASIC fingerprints a visitor
consent withdrawal leaves tracking IDs behind
collector bypasses sanitization
form values are automatically collected
unknown query parameters are persisted
```

If any of these occur, fix them before continuing feature work.

---

## 35. Migrations

Never use application startup to destructively recreate the database.

Production startup may:

- check schema version
- run explicitly supported forward migrations

It must never automatically:

```text
DROP DATABASE
DROP TABLE
TRUNCATE analytics data
```

Provide separate explicit development reset commands.

---

## 36. Seed data

Demo and development seed data must be synthetic.

Do not copy production analytics into fixtures.

Seed data should cover:

- BASIC traffic
- CONSENTED traffic
- campaigns
- referrers
- events
- performance
- devices
- funnels

This allows dashboard development without privacy-sensitive datasets.

---

## 37. Documentation

Keep these documents aligned with behavior:

```text
README.md
docs/architecture.md
docs/integration.md
docs/privacy-design.md
docs/data-dictionary.md
docs/legal-checklist.md
docs/custom-events.md
```

A code change that changes tracked data is incomplete until the data dictionary and privacy documentation have been reviewed.

---

## 38. Legal wording

Do not claim:

```text
100% GDPR compliant
guaranteed GDPR compliant
no consent required
legally safe
```

as unconditional statements.

Use factual descriptions of technical behavior.

Good:

> In BASIC mode lumly does not create persistent visitor identifiers.

Bad:

> BASIC mode is guaranteed to require no consent.

Legal assessment depends on deployment, configuration, purpose and jurisdiction.

---

## 39. Working with existing code

Before changing code:

1. inspect the relevant existing files
2. understand the current data flow
3. identify existing tests
4. preserve working behavior unless the task requires changing it

Do not perform unrelated refactors.

Do not rewrite working modules merely because another style is preferred.

Prefer the smallest coherent change.

---

## 40. TypeScript

Keep strict TypeScript enabled.

Avoid `any` unless interfacing with genuinely untyped external input, and narrow it immediately.

Prefer `unknown` at trust boundaries.

Validate runtime input independently of TypeScript types.

Database rows, HTTP payloads and browser storage values are runtime data, not trusted TypeScript objects.

---

## 41. Naming

Use terminology consistently:

```text
site
event
page_view
visitor
session
tracking_mode
basic
consented
```

Do not randomly introduce synonyms for established domain concepts unless the model is intentionally being changed.

---

## 42. Date and time handling

Store timestamps in UTC.

Perform reporting timezone conversion based on the site's configured timezone.

Do not rely on the server's local timezone.

Date range queries must have explicit inclusive/exclusive semantics.

Prefer:

```text
start <= timestamp < end
```

---

## 43. Query performance

All high-volume analytics queries must be reviewed for:

- date filtering
- site filtering
- index usage
- bounded result size

Avoid unrestricted:

```sql
SELECT *
```

against the events table.

Paginate raw event administration.

Use rollups for common long-range dashboards.

---

## 44. Deployment

The standard production deployment is Docker Compose.

Keep this path working.

A normal update should consist roughly of:

```text
pull/build image
run migrations
restart application
```

Do not make deployment dependent on proprietary services.

---

## 45. Definition of done for agent work

Before finishing a task:

- code is implemented
- types pass
- tests pass
- build passes
- migrations exist if necessary
- documentation is updated if behavior changed
- privacy invariants remain intact
- no debug code remains
- no fake production data remains
- no TODO is left in place of requested functionality

When something cannot be completed, state the concrete missing piece rather than presenting a partial implementation as complete.

---

## 46. Final principle

lumly exists to produce useful analytics without turning every visitor into a surveillance target.

When choosing between slightly more analytics and a materially stronger privacy guarantee, prefer the stronger privacy guarantee unless the additional tracking is explicitly placed behind CONSENTED mode.

Never silently weaken BASIC mode.
