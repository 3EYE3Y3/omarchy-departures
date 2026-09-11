# Departures

> Know when to go.

Departures is an arrival-first assistant for Omarchy. Tell it where you are going and when you need to arrive; it makes the next action and leave time obvious.

```text
Dentist tomorrow at 2pm at City Dental Clinic
```

The bar stays compact. The panel is a departures board: every upcoming trip is shown in aligned ARRIVE, DESTINATION, LEAVE, and STATUS columns, with compact day groups and a single next-action strip. Select a row for timing, reminders, routing freshness, Retry, Edit, and Delete. Technical routing details stay out of the way unless you ask for them.

## Travel time

Every departure uses exactly one travel-time source:

- **Automatic** (the default) fetches a route when saved and keeps refreshing it more often as leave time approaches. It safely keeps the most recent usable duration when routing is temporarily unavailable.
- **Fixed time** uses the duration you enter. Route refreshes are paused and cannot move travel, leave, get-ready, or notification timing.

Internally these remain mutually exclusive AUTO/MANUAL modes. Their values are stored separately, so switching is predictable and a previous fixed value is restored when switching back.

## What Departures learns

- Destinations become saved places automatically.
- Repeated travel, safety, parking, walking, preparation, and preferred-origin values become that place's defaults.
- Work, Gym, Hockey, Airport, School, Fishing, Sport, and Shopping bring kits work immediately.
- Edited reminder lists can be remembered as the kit for that activity.
- Reminders stay available in a departure's details without crowding the board.

Everything learned is ordinary local data—not analytics or an AI service. It can be viewed, edited, removed, or reset through the CLI.

## Install

```bash
omarchy plugin add https://github.com/3EYE3Y3/omarchy-departures.git --enable --yes
```

Departures is added to the center bar section by default. Move it if preferred:

```bash
omarchy bar move io.github.3eye3y3.departures --section right
```

Click the bar item to open the board, or run:

```bash
bin/departures open
bin/departures new
```

## Fast creation

Natural input is deterministic and local. It recognizes `today`, `tomorrow`, weekdays, ISO dates, 12/24-hour times, and a destination after `at`, `in`, or `to`.

```bash
bin/departures add "Dentist tomorrow at 2pm at City Dental Clinic"
bin/departures add "Gym Friday at 18:30 at City Fitness Centre"
bin/departures add "Airport at 9am at International Terminal"
```

If no date is supplied, the next occurrence of the time is used. Missing fields are reported explicitly. The structured editor and JSON CLI remain available as fallbacks:

```bash
bin/departures add '{"title":"Morning Meeting","destination":"Central Office","arrivalTime":1789115400000,"timingMode":"manual","manualTravelMinutes":25,"autoTravelMinutes":23,"arrivalBufferMinutes":10,"preparationMinutes":30,"parkingMinutes":5,"walkingMinutes":4,"transportMode":"drive","profile":"custom","reminders":["Notebook"]}'
```

## Routing providers

Departures works with no network, account, key, or provider. Automatic timing falls back to a saved estimate when routing is unavailable. Fixed time never changes on its own.

Free routing is an explicit privacy opt-in. Enable it in the panel or CLI:

```bash
bin/departures config network on
```

This enables:

- Nominatim/OpenStreetMap forward geocoding, cached per saved place
- OSRM/OpenStreetMap no-key driving routes, cached per coordinate pair and mode
- leave-time-aware route refreshes for every upcoming Automatic departure

Public community endpoints are best-effort rather than an availability guarantee. If routing cannot refresh but a saved duration exists, the board remains usable and quietly says that saved timing is in use. If no duration exists, the row says `ROUTE NEEDED` instead of inventing a leave time. Provider identity, failure reason, Refresh now, and Edit locations are available after selecting the row. Disable external calls at any time:

```bash
bin/departures config network off
```

See [provider details](docs/PROVIDERS.md) for policies and fallback behavior, and [routing diagnostics](docs/ROUTING_DIAGNOSTICS.md) for the v0.3 investigation.

## Optional live traffic

If free routing is enabled and `MAPBOX_ACCESS_TOKEN` (or `DEPARTURES_MAPBOX_TOKEN`) is present in the Omarchy shell environment, Departures automatically prefers Mapbox `driving-traffic`. No token is stored in the state file or repository.

A persistent per-user environment example:

```text
# ~/.config/environment.d/departures.conf
MAPBOX_ACCESS_TOKEN=your_public_access_token
```

Log out/in after changing `environment.d`, or import the variable into the user environment and restart the shell. Mapbox is optional and may require an account or billing under its current terms; invalid credentials degrade to remembered timing.

## Origins, places, and current location

Places are created implicitly when departures are saved. They can also be managed explicitly:

```bash
bin/departures places
bin/departures place set '{"name":"Central Office","address":"123 Example Street","coordinates":{"latitude":10.5,"longitude":20.5},"normalTravelMinutes":25}'
bin/departures config origin "Central Office"
bin/departures place remove "Central Office"
```

The current Omarchy 4.0.3 installation does not expose a permission-capable location API and this machine has no GeoClue client installed. Departures therefore supports an explicit, session-only coordinate handoff:

```bash
bin/departures location "10.5000,20.5000" "Current location"
bin/departures config origin "Current location"
```

The coordinates above are deliberately synthetic documentation data. A supplied sample is held only in memory and is not added to state or location history. `DEPARTURES_CURRENT_LOCATION=latitude,longitude` is also supported for an explicitly configured shell session.

## Bring kits and learned data

```bash
bin/departures kits
bin/departures kit set '{"key":"dentist","items":["Health card","Referral"]}'
bin/departures kit remove dentist
bin/departures reset-learning
```

`reset-learning` clears places, custom kits, and route cache, but leaves departures and notification history intact.

## Navigation handoff

`ROUTE` opens a standards-compliant Google Maps directions URL in the system browser. It needs no API key. Departures remains responsible for when to leave; the external application handles navigation.

## Data and privacy

State lives at `$XDG_STATE_HOME/omarchy/departures/state.json`, falling back to `~/.local/state/omarchy/departures/state.json`. Writes are serialized, atomically renamed, and mode `0600`.

No analytics, telemetry, account, cloud backend, or departure-history upload exists. When free routing is enabled, only origin/destination search text or route coordinates are sent to the selected providers. See [privacy](docs/PRIVACY.md).

All public screenshots, examples, demos, and fixtures in this project must use clearly fictional generic data. Release captures must be made with isolated demo state, never a user's persisted state.

## Development

The suite has no third-party dependencies:

```bash
npm test
scripts/quality
```

See [architecture](docs/ARCHITECTURE.md), [board stability diagnosis](docs/BOARD_STABILITY.md), [testing and acceptance](docs/TESTING.md), and [Omarchy compatibility](docs/UPSTREAM_COMPATIBILITY.md).

## License

MIT
