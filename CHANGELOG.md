# Changelog

## 0.2.0 — 2026-09-11

- Add autonomous natural-language creation with remembered logistics defaults.
- Add first-class saved places and reusable learned bring kits.
- Extend arrival-first timing with parking and walking allowances.
- Add opt-in no-key Nominatim geocoding and OSRM driving routes with aggressive caching.
- Add optional Mapbox traffic-aware routing through environment credentials.
- Add material-change hysteresis and transparent departure-time adjustments.
- Add ephemeral current-location handoff and external navigation URLs.
- Migrate v0.1 state atomically to schema v2 while preserving departures and notification keys.
- Expand deterministic automated coverage for providers, failures, caching, migration, natural input, places, kits, and privacy boundaries.

## 0.1.0 — 2026-09-11

- Create, edit, and delete manual departures.
- Derive get-ready, leave, target-arrival, and event times.
- Show a live next-action board and compact bar status.
- Persist departures and deduplicated notification state locally.
- Notify once at GET READY and once at LEAVE NOW.
- Include lightweight Work, School, Airport, Fishing, Sport, and Shopping presets.
