# Testing and acceptance

Departures 0.1.0 was developed and accepted against Omarchy 4.0.3-1 and Quickshell 0.3.1.

## Automated

`npm test` covers calculations, zero durations, sorting, next departure/action, future dates, midnight, expiry, status transitions, validation, CRUD, editing/recalculation, multiple departures, and notification deduplication across reload boundaries.

`scripts/quality` additionally runs the installed Omarchy manifest validator, QML lint, Bash syntax checks, ShellCheck when available, and Git whitespace checks.

The installed Qt `qmllint` cannot statically infer the members of Omarchy's dynamic `Style.font` object, injected bar facade, or `Loader.item`, and Quickshell's metadata does not expose `QProcess::ExitStatus` to the linter. It reports those known `missing-property`/signal-metadata warnings while returning success. Live shell testing is therefore also required and produced no Departures runtime warning after the supported typography-token correction.

## Local acceptance completed

- Installed from the public Git repository with `omarchy plugin add --enable --yes`.
- Confirmed registry recognition, service availability with the panel closed, bar rendering, panel open/close, empty state, editor rendering, keyboard create, service edit/delete, sorting, and immediate next-departure updates.
- Confirmed derived get-ready, leave, target-arrival, and event times, including a departure whose preparation and leave times cross midnight.
- Observed `LEAVE SOON`, `LEAVE NOW`, and expiry transitions in the live service; the bar and panel updated without reconstruction.
- Confirmed atomic state creation with mode `0600`, persistence through multiple shell restarts, one GET READY notification, one LEAVE NOW notification, and no duplicates after a restart at either boundary.
- Removed all acceptance records and notification artifacts, then restarted the shell and confirmed pristine empty state.
