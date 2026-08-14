Lumly mount-path fix

- Vite assets use relative base ./
- Dashboard derives its public base from the loaded JS module URL
- API requests and exports resolve below that base
- React Router uses the derived basename
- Integration snippet is assembled by the dashboard with the real public base
- Tracker fallback derives /api/v1/collect from tracker.js location, including subdirectories
- CORS preflight remains transport-only; site/origin authorization stays on POST
