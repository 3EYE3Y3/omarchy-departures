# Omarchy compatibility

Departures 0.1.0 targets Omarchy 4.0.3's schema version 1 plugin API.

It uses documented `service` and `bar-widget` kinds, the public entry-point property injection contract, the bar's own-service facade, native `KeyboardPanel`/`Panel` conventions, `Qt.resolvedUrl`, and the supported `omarchy-notification-send` mechanism.

The plugin does not depend on sanitized private manifest fields, undocumented install hooks, or a separate daemon.
