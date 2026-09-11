# Testing and acceptance

Departures 0.3.0 was developed and accepted against Omarchy 4.0.3-1 and Quickshell 0.3.1 on 2026-09-11.

## Automated

`npm test` runs deterministic tests with no live third-party requests. Coverage includes:

- explicit AUTO/MANUAL authority, mode switching, value preservation, arrival-first timing, zero durations, missing timing, sorting, status, future dates, and midnight
- domain validation, CRUD, recalculation, v0.1 record restoration, and notification revision behavior
- notification deduplication across reload and dynamic route-time changes
- Nominatim, OSRM, Mapbox, location, and future-weather result normalization
- malformed provider data, no results, no route, DNS, timeout, invalid credential, and rate-limit classification
- route cache freshness/staleness, bounded size, coordinate keys, and progressive refresh cadence
- immediate material increases, ignored small changes, and confirmed decreases
- saved-place creation, matching, averaging, geocoding, observed route learning, and removal
- built-in/learned bring kits, replacement, and reset
- local natural-language parsing and missing-field reporting
- schema-v1/v2-to-v3 state migration with preserved records, learned data, cache, settings, and notification keys
- first-run, Add/editor, details, long-label, fallback-severity, and human-readable primary-panel UI contracts
- route-work gating in MANUAL mode and manual provider observations that cannot move timing or notification keys
- keyless navigation URL generation and absent-credential capability behavior
- permanent public-data privacy policy checks

The v0.3.0 suite contains 93 tests and runs on Node.js 22.

`scripts/quality` additionally runs the installed Omarchy manifest validator, QML lint, Bash syntax checks, ShellCheck when available, and Git whitespace checks.

The installed Qt `qmllint` cannot statically infer the members of Omarchy's dynamic `Style.font` object, injected bar facade, or `Loader.item`, and Quickshell's metadata does not expose `QProcess::ExitStatus` to the linter. It reports those known `missing-property`/signal-metadata warnings while returning success. Live shell testing produced no Departures runtime warning. ShellCheck was not installed; `bash -n` passed for both scripts.

## v0.3.0 effortless-UX acceptance

- Stopped the shell, moved the user's state into an opaque temporary backup, and verified its checksum before using an empty isolated state. No desktop capture was made.
- Opened the empty panel and compose entry point. The first-run state and fresh editor loaded without a Departures QML warning; automated contracts verify that both Add actions use the editor rather than empty quick-create.
- Created fictional Automatic and Fixed time departures. Both appeared immediately in state and the derived snapshot.
- Confirmed Fixed time remained authoritative through refresh opportunities and Retry was correctly unavailable for that mode.
- Exercised Automatic → Fixed time, changed the fixed value, then returned to Automatic. The automatic value became authoritative again and the fixed value remained preserved.
- Confirmed edit and delete behavior, then restarted the shell and verified timing-mode persistence.
- Used generic sample endpoints for a live valid OSRM route and a provider-rejected route. The valid route reached live state; the failure kept its saved duration, reliable next action, unchanged revision semantics, and working Retry action.
- Exercised a deliberately degraded fictional record with neither duration. It survived restart, produced no fabricated leave time, used the blocking card, and remained ineligible for timing notifications.
- Opened the primary card and reached the details path with keyboard navigation; no component warning was emitted. The human UI contract separately verifies that routing diagnostics and recovery controls are absent from the primary card and present in details.
- Restored the user's original state byte-for-byte at mode `0600`, restarted the final candidate, and confirmed service/snapshot availability without a Departures runtime warning.

The acceptance state used only fictional labels, was never captured, and remained outside the repository. It was removed after restoration.

## Local acceptance completed

- Updated through `omarchy plugin update`, restarted only the Omarchy shell, and confirmed plugin/service IPC availability.
- Migrated the existing empty schema-v1 state to schema v2; confirmed the state file remained mode `0600`.
- Created a fictional `Morning Meeting` at `Central Office` through the natural CLI and confirmed the expected built-in kit behavior.
- Confirmed implicit place creation and learning of travel, safety, preparation, parking, walking, kit, and preferred-origin fields.
- Edited parking/walking values and created another departure for the same destination; remembered averaged defaults and kit were applied.
- Enabled free routing explicitly against isolated fictional acceptance state and confirmed normalized geocoding and routing responses without documenting private locations.
- Confirmed a material 20→25 minute increase moved the leave time earlier and displayed its cause while preserving the user-edit revision.
- Created another route for the same coordinate pair and confirmed the persisted cache was reused without another geocode.
- Submitted an unresolvable destination and confirmed the departure retained manual timing while the service, bar, and panel remained operational.
- Injected an explicit session-only current coordinate, selected it as origin, and confirmed schema-v2 state contained no current-location sample. After restart, capability returned to unavailable as designed.
- Visually inspected the board and expanded editor. A collapsed-list sizing regression was found, fixed, reinstalled, and recaptured; destination/leave hierarchy, logistics, provider state, readiness controls, and scrolling rendered correctly.
- Created a 90-second notification fixture. Exactly one GET READY and one LEAVE NOW notification fired; both keys were saved before delivery and the count remained 2 after shell restart.
- Checked a bring item through live IPC and confirmed it persisted across another shell restart without changing notification keys.
- Confirmed service operation with the panel closed, bar updates, network-disabled operation, and provider recovery through subsequent valid requests.
- Removed only the isolated fictional acceptance state and notification artifacts, then restored the user's original state byte-for-byte.

Temporary captures remain outside the repository and are removed after review. They are never made from the user's persisted state.

## v0.2.1 corrective acceptance

- Installed the candidate into the existing git-managed user plugin and restarted only the Omarchy shell.
- Backed up the user's state opaquely, stopped the shell, and ran acceptance against isolated schema-v2 fictional state. The migration produced schema v3, retained the departure, place, and notification key, mapped legacy travel/route durations to manual/automatic values, removed legacy fields, and kept mode `0600`.
- Invoked the panel's compose entry point and loaded the new editor without a Departures runtime error. Escape/Cancel left the departure count unchanged. The primary `+ ADD` binding and editor reset path are also covered by the UI contract test.
- Created fictional AUTO and MANUAL departures. Both appeared immediately in durable state and the derived snapshot; the bar continued to identify the earliest fictional departure.
- Confirmed MANUAL used its entered duration, queued no route work, retained its leave time and revision during refresh opportunities, and preserved the cached automatic value.
- Exercised AUTO → MANUAL, changed the manual duration, then exercised MANUAL → AUTO. Automatic authority resumed and the changed manual value remained available.
- Restarted the shell and confirmed both modes and both values persisted. Edit updated the derived preview; Delete removed only the selected acceptance records.
- Restored the user's original state byte-for-byte and verified its checksum before the final restart. The installed v0.2.1 service then migrated the real schema-v2 envelope to schema v3 while preserving all departure IDs, places, and notification keys.
- Retained no screenshot, demo state, backup, or acceptance log. The final shell reported no Departures runtime error.
