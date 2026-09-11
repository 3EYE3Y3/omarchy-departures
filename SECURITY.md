# Security

## Reporting

Please report security issues privately through GitHub's security-advisory interface rather than a public issue.

## Data boundary

Departures defaults to no network requests. Its only persistent data is the local state file under `$XDG_STATE_HOME/omarchy/departures/`, written with mode `0600`. Notification content is sent to the local Omarchy notification service.

When the user explicitly enables free routing, Departures sends only unknown place text to Nominatim and route coordinates/mode to OSRM or configured Mapbox. Event titles, times, notes, reminders, and history are not sent.

Optional Mapbox tokens are read only from the shell process environment and are never persisted. Do not place credentials in repository files, issue reports, or diagnostic logs. `.env` files are ignored defensively.

Like all Omarchy shell plugins, Departures runs as unsandboxed user code inside the Quickshell process. Review the source and install only from a repository you trust.
