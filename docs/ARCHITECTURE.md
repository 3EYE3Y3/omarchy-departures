# Architecture

Departures follows Omarchy 4.0.3's public third-party plugin contract.

- `Service.qml` is the long-lived owner of records, live time, persistence, and notifications. It is mounted whenever the plugin is enabled and reconstructs from durable state on a shell/plugin reload.
- `BarWidget.qml` reads the plugin's own service through the capability-scoped shell facade and owns the panel loader.
- `Panel.qml` and `DepartureEditor.qml` contain presentation and user interaction only.
- `js/timing.js` is the deterministic timing and next-action engine.
- `js/domain.js` validates and mutates records without QML dependencies.
- `js/notification_state.js` decides notification eligibility and durable deduplication keys.
- `js/profiles.js` contains intentionally lightweight presets.
- `bin/departures` is a thin local IPC client; the bar widget forwards its calls to the service and contains no storage logic.

Plugin-local resources are resolved with `Qt.resolvedUrl`. No code reads private manifest metadata such as `manifest.__sourceDir`.

State is stored at `$XDG_STATE_HOME/omarchy/departures/state.json`, falling back to `~/.local/state/omarchy/departures/state.json`. Writes are serialized and atomically renamed into place. A notification key contains the departure ID, record revision, and boundary kind; the key is committed before its notification is emitted.
