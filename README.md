# Departures

> Know when to go.

Departures is an arrival-first departure assistant for Omarchy. Describe an obligation; Departures works backwards through safety margin, parking, walking, travel, and preparation to make the right leave time obvious.

```text
Dentist tomorrow at 2pm at Example Clinic
```

The bar stays compact. The panel uses a high-density passenger-information layout, continuously advances through `ON TIME`, `GET READY`, `LEAVE SOON`, `LEAVE NOW`, and `DEPARTED`, and explains material route changes rather than silently moving the time.

## What v0.2 learns

- Destinations become saved places automatically.
- Repeated travel, safety, parking, walking, preparation, and preferred-origin values become that place's defaults.
- Work, Gym, Hockey, Airport, School, Fishing, Sport, and Shopping bring kits work immediately.
- Edited reminder lists can be remembered as the kit for that activity.
- Ready items are checked directly on the next-departure board.

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
bin/departures add "Dentist tomorrow at 2pm at Example Clinic"
bin/departures add "Hockey Friday at 18:30 at Example Ice Arena"
bin/departures add "Gym at 9am at Example Fitness"
```

If no date is supplied, the next occurrence of the time is used. Missing fields are reported explicitly. The structured editor and JSON CLI remain available as fallbacks:

```bash
bin/departures add '{"title":"Dinner","destination":"Example City","arrivalTime":1789115400000,"travelMinutes":23,"arrivalBufferMinutes":10,"preparationMinutes":30,"parkingMinutes":5,"walkingMinutes":4,"transportMode":"drive","profile":"custom","reminders":["Keys"]}'
```

## Routing modes

Departures works with no network, account, key, or provider. The default is **Cached / remembered**: manual values and locally learned durations remain authoritative.

Free routing is an explicit privacy opt-in. Enable it in the panel or CLI:

```bash
bin/departures config network on
```

This enables:

- Nominatim/OpenStreetMap forward geocoding, cached per saved place
- OSRM/OpenStreetMap no-key driving routes, cached per coordinate pair and mode
- progressively scheduled refreshes near the next departure

Public community endpoints are best-effort rather than an availability guarantee. Provider failure, timeout, DNS failure, malformed data, and stale results fall back to cached, learned, or manual duration without blocking the plugin. Disable external calls at any time:

```bash
bin/departures config network off
```

See [provider details](docs/PROVIDERS.md) for policies, caching, and failure behavior.

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
bin/departures place set '{"name":"Home","address":"10 Example St, Example City","coordinates":{"latitude":10.5,"longitude":20.5},"normalTravelMinutes":25}'
bin/departures config origin Home
bin/departures place remove Home
```

The current Omarchy 4.0.3 installation does not expose a permission-capable location API and this machine has no GeoClue client installed. Departures therefore supports an explicit, session-only coordinate handoff:

```bash
bin/departures location "10.5000,20.5000" "Current location"
bin/departures config origin "Current location"
```

The sample is held only in memory and is not added to state or location history. `DEPARTURES_CURRENT_LOCATION=latitude,longitude` is also supported for an explicitly configured shell session.

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

## Development

The suite has no third-party dependencies:

```bash
npm test
scripts/quality
```

See [architecture](docs/ARCHITECTURE.md), [testing and acceptance](docs/TESTING.md), and [Omarchy compatibility](docs/UPSTREAM_COMPATIBILITY.md).

## License

MIT
