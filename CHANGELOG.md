# Changelog

## 0.3.0 — 2026-09-11

- Redesign the panel around destination, next action, leave time, travel duration, and timing source.
- Add a concise first-run state and a destination-first editor with Automatic/Fixed time wording and progressive disclosure.
- Keep reliable departures calm during provider failures; move provider identity and raw diagnostics into an optional details section.
- Add contextual Retry and Edit locations recovery actions without hiding genuine blocking timing failures.
- Normalize OSRM `NoRoute`, preserve its diagnostic code, and verify correct longitude/latitude request ordering.
- Preserve damaged departures with missing timing for repair, while suppressing unreliable leave calculations and notifications.
- Add a human-readable UX contract plus fallback, empty-state, long-label, degraded-timing, routing, and privacy regression coverage.

## 0.2.1 — 2026-09-11

- Add an explicit mutually exclusive AUTO/MANUAL timing mode with separate persisted durations.
- Suspend and ignore provider timing work for MANUAL departures while retaining AUTO routing hysteresis and fallback.
- Migrate schema-v2 state to schema v3 without losing departures, learned data, route cache, settings, or notification keys.
- Fix the prominent Add button so it opens a fresh validated departure editor instead of submitting an empty quick-create.
- Add compact timing-mode controls, clear timing authority labels, and live derived previews.
- Establish a permanent fictional-data requirement for screenshots, demos, documentation, release assets, and public fixtures.

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
