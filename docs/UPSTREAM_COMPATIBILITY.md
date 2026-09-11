# Omarchy compatibility

Departures 0.3.1 targets Omarchy's schema version 1 plugin-manifest API and Quickshell 0.3.1.

It uses documented `service` and `bar-widget` kinds, the public entry-point property injection contract, the bar's own-service facade, native `KeyboardPanel`/`Panel` conventions, `Qt.resolvedUrl`, and the supported `omarchy-notification-send` mechanism.

The independent service continues to run whenever the plugin is enabled, regardless of panel visibility. Provider HTTP work uses bounded `curl` subprocesses through Quickshell's supported process API; failure never affects service hydration.

The plugin does not depend on sanitized private manifest fields, undocumented install hooks, a separate daemon, or `manifest.__sourceDir`.
