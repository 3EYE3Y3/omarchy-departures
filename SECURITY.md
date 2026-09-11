# Security

## Reporting

Please report security issues privately through GitHub's security-advisory interface rather than a public issue.

## Data boundary

Departures makes no network requests. Its only persistent data is the local state file under `$XDG_STATE_HOME/omarchy/departures/`, written with mode `0600`. Notification content is sent to the local Omarchy notification service.

Like all Omarchy shell plugins, Departures runs as unsandboxed user code inside the Quickshell process. Review the source and install only from a repository you trust.
