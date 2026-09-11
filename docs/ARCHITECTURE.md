# Architecture

Departures 0.2 follows Omarchy 4.0.3's public third-party plugin contract.

- `Service.qml` is the long-lived orchestrator for records, live time, persistence, notifications, provider jobs, rate limiting, and failure backoff. It is mounted whenever the plugin is enabled and reconstructs from durable state on a shell/plugin reload.
- `BarWidget.qml` reads the plugin's own service through the capability-scoped shell facade and owns the panel loader.
- `Panel.qml` and `DepartureEditor.qml` contain presentation and user interaction only.
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
