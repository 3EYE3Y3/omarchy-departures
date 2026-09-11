# Testing and acceptance

Departures 0.2.0 was developed and accepted against Omarchy 4.0.3-1 and Quickshell 0.3.1 on 2026-09-11 in a local test timezone.

## Automated

`npm test` runs deterministic tests with no live third-party requests. Coverage includes:

- legacy and arrival-first timing, zero durations, sorting, status, future dates, and midnight
- domain validation, CRUD, recalculation, v0.1 record restoration, and notification revision behavior
- notification deduplication across reload and dynamic route-time changes
- Nominatim, OSRM, Mapbox, location, and future-weather result normalization
- malformed provider data, no results, no route, DNS, timeout, invalid credential, and rate-limit classification
- route cache freshness/staleness, bounded size, coordinate keys, and progressive refresh cadence
- immediate material increases, ignored small changes, and confirmed decreases
- saved-place creation, matching, averaging, geocoding, observed route learning, and removal
- built-in/learned bring kits, replacement, and reset
- local natural-language parsing and missing-field reporting
- schema-v1-to-v2 state-envelope migration
- keyless navigation URL generation and absent-credential capability behavior

`scripts/quality` additionally runs the installed Omarchy manifest validator, QML lint, Bash syntax checks, ShellCheck when available, and Git whitespace checks.

The installed Qt `qmllint` cannot statically infer the members of Omarchy's dynamic `Style.font` object, injected bar facade, or `Loader.item`, and Quickshell's metadata does not expose `QProcess::ExitStatus` to the linter. It reports those known `missing-property`/signal-metadata warnings while returning success. Live shell testing produced no Departures runtime warning. ShellCheck was not installed; `bash -n` passed for both scripts.

## Local acceptance completed

- Updated through `omarchy plugin update`, restarted only the Omarchy shell, and confirmed plugin/service IPC availability.
- Migrated the existing empty schema-v1 state to schema v2; confirmed the state file remained mode `0600`.
- Created `ACPT Work tomorrow at 8am at ACPT Test Office` through the natural CLI. Parsing selected tomorrow 08:00 and automatically attached the built-in Work kit.
- Confirmed implicit place creation and learning of travel, safety, preparation, parking, walking, kit, and preferred-origin fields.
- Edited parking/walking values and created another departure for the same destination; remembered averaged defaults and kit were applied.
- Enabled free routing explicitly with Australian geocoding scope. Nominatim resolved Example Clinic; OSRM returned a 25-minute/22.9 km route from the disposable test origin.
- Confirmed a material 20→25 minute increase moved the leave time earlier and displayed its cause while preserving the user-edit revision.
- Created another route for the same coordinate pair and confirmed the persisted cache was reused without another geocode.
- Submitted an unresolvable destination and confirmed the departure retained manual timing while the service, bar, and panel remained operational.
- Injected an explicit session-only current coordinate, selected it as origin, and confirmed schema-v2 state contained no current-location sample. After restart, capability returned to unavailable as designed.
- Visually inspected the board and expanded editor. A collapsed-list sizing regression was found, fixed, reinstalled, and recaptured; destination/leave hierarchy, logistics, provider state, readiness controls, and scrolling rendered correctly.
- Created a 90-second notification fixture. Exactly one GET READY and one LEAVE NOW notification fired; both keys were saved before delivery and the count remained 2 after shell restart.
- Checked a bring item through live IPC and confirmed it persisted across another shell restart without changing notification keys.
- Confirmed service operation with the panel closed, bar updates, network-disabled operation, and provider recovery through subsequent valid requests.
- Removed only uniquely identified acceptance departures, places, learned kit, route cache, and two Departures notification files. A separately created real Work place/cache was preserved.

Temporary captures remained under `/tmp` only and were not committed because they contain desktop content.
