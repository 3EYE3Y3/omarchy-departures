# Architecture

Departures 0.3 follows Omarchy's public third-party plugin contract.

- `Service.qml` is the long-lived orchestrator for records, live time, persistence, notifications, provider jobs, rate limiting, and failure backoff. It is mounted whenever the plugin is enabled and reconstructs from durable state on a shell/plugin reload.
- `BarWidget.qml` reads the plugin's own service through the capability-scoped shell facade and owns the panel loader.
- `Panel.qml`, `DepartureBoardRow.qml`, `DepartureDetails.qml`, and `DepartureEditor.qml` contain presentation and user interaction only.
- `js/board.js` maps enriched departures into stable board roles and reconciles a QML `ListModel` by departure ID without clearing it.
- `js/presentation.js` maps timing and provider state into user-impact language; raw provider failures never decide primary-board severity.
- `js/timing.js` is the deterministic timing and next-action engine.
- `js/domain.js` validates and mutates records without QML dependencies.
- `js/notification_state.js` decides notification eligibility and durable deduplication keys.
- `js/profiles.js` contains intentionally lightweight presets.
- `js/providers.js` normalizes Nominatim, OSRM, and Mapbox responses and builds safe provider requests.
- `js/routing.js` owns cache keys, refresh cadence, material-change hysteresis, and navigation handoff URLs.
- `js/places.js` owns remembered destinations and ordinary running averages.
- `js/kits.js` owns built-in and learned bring lists.
- `js/natural.js` performs deterministic local low-friction parsing.
- `js/location.js` validates ephemeral coordinates without persistence.
- `js/weather.js` defines the future normalized WeatherProvider boundary without making requests.
- `js/storage.js` migrates schema-v1 and schema-v2 envelopes into schema v3.
- `bin/departures` is a thin local IPC client; the bar widget forwards its calls to the service and contains no storage logic.

Plugin-local resources are resolved with `Qt.resolvedUrl`. No code reads private manifest metadata such as `manifest.__sourceDir`.

State is stored at `$XDG_STATE_HOME/omarchy/departures/state.json`, falling back to `~/.local/state/omarchy/departures/state.json`. Schema v3 adds explicit `timingMode`, `manualTravelMinutes`, and `autoTravelMinutes`. A new AUTO departure keeps `manualTravelMinutes` null until MANUAL is first selected, so that first switch seeds from the current effective automatic duration. A schema-v2 departure migrates to AUTO because v0.2 allowed providers to control timing; its old `travelMinutes` becomes the preserved manual value and an accepted `routeTravelMinutes` becomes the automatic value. Without an accepted route, both values start from the old travel duration. Places, kits, settings, route cache, departures, IDs, revisions, and notification keys are preserved. Writes are serialized and atomically renamed into place.

Timing first selects one effective duration: `manualTravelMinutes` in MANUAL, or the accepted/cached `autoTravelMinutes` in AUTO. It then derives target arrival, walking, parking, leave, and get-ready boundaries deterministically. Provider results are ignored for MANUAL departures and never calculate notification boundaries themselves. A notification key contains departure ID, user-edit revision, and boundary kind; provider refreshes deliberately retain the revision.

If a persisted departure has neither timing value, restore keeps it visible for repair. Derived timing is marked unreliable, its board row says `ROUTE NEEDED`, and no notification is eligible until the user supplies a duration. This is intentionally distinct from provider failure with a saved duration, which remains reliable and informational.

## Stable board updates

The service still derives a fresh immutable timing snapshot on its shared 15-second clock, but that snapshot is not the visual list model. In v0.3.0, binding delegates directly to each newly allocated snapshot array caused QML to discard and recreate the visible list every tick and after provider results. That looked like a panel crash/reset and lost transient row, focus, and scroll state.

The service now owns one long-lived QML `ListModel`. `js/board.js` compares the desired rows with that model by stable departure ID, removes only expired/deleted IDs, inserts only new IDs, moves only changed ordering, and calls `setProperty` only for roles that changed. An ordinary clock tick therefore performs zero model operations. A material route result normally changes one row. The board stays instantiated while details or the editor is visible, and its clamped scroll position is restored on return.

## Central route scheduler

The same 15-second service timer that updates countdowns calculates the earliest due route refresh across all upcoming Automatic departures. There are no per-row or per-departure polling timers. Eligibility is based on time until derived leave time and stops at leave time. Fixed-time records are excluded before queueing; queued work is removed on a switch to Fixed, and in-flight results are ignored if the mode changed.

Automatic saves use one immediate path for creates, edits, mode activation, and origin/destination changes. Immediate work bypasses a fresh cache so it actually consults the selected provider, subject to the existing queue, provider spacing, and failure backoff. Scheduled work can reuse fresh cache data. Provider results update the matching durable record, derive timing again, reconcile the matching row, and recompute the next-action/bar state. User-edit revision is unchanged by provider work.
