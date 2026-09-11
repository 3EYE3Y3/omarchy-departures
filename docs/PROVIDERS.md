# Providers and fallback behavior

Departures consumes normalized results. UI, timing, persistence, and notifications never parse vendor payloads directly.

## Capability layers

- **LocationProvider:** saved/manual origins plus an explicit, ephemeral current-coordinate sample. GeoClue discovery is deferred because no client is installed and Omarchy 4.0.3 exposes no location-permission surface to third-party plugins.
- **GeocodingProvider:** Nominatim forward search. It returns a normalized label, coordinates, provider ID, and attribution.
- **RoutingProvider:** OSRM driving routes. It returns normalized duration, distance, and traffic-awareness fields.
- **TrafficProvider:** optional Mapbox Directions `driving-traffic`, walking, or cycling route. A token is read from process environment only.
- **WeatherProvider:** a normalized contract exists in `js/weather.js`; network weather queries and contextual prompts are intentionally deferred.

## Public no-key services

Nominatim calls use `https://nominatim.openstreetmap.org/search`, identify Departures in `User-Agent`, never provide autocomplete, request one result, are serialized at least 1.1 seconds apart, and are cached as saved places. This follows the [Nominatim public usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [search API](https://nominatim.org/release-docs/latest/api/Search/). OpenStreetMap attribution is shown through the provider identity in documentation and capability details.

OSRM calls use the public project route endpoint for no-key driving estimates and follow the documented [OSRM route API](https://project-osrm.org/docs/) and [demo-server usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy). The hosted endpoint is a community demonstration service with no availability guarantee and prohibits excessive use. Departures therefore applies a five-minute per-departure floor, spaces all OSRM requests by at least two seconds, caches aggressively, and falls back immediately. OSRM is a current route estimate, not a traffic feed.

## Optional Mapbox traffic

Mapbox is selected automatically only when networking is enabled and `MAPBOX_ACCESS_TOKEN` or `DEPARTURES_MAPBOX_TOKEN` exists. The [Directions API](https://docs.mapbox.com/api/navigation/directions/) documents `driving-traffic`, live/historical traffic behavior, `duration_typical`, credentials, rate limits, and billing. Departures requests only duration/distance and no geometry or steps.

Tokens are not written to state, logs, documentation output, or IPC state. A rejected token enters a one-hour backoff; Automatic timing continues from cache or learning and Fixed time remains unchanged.

## Refresh and cache algorithm

Every upcoming Automatic departure is eligible. Creation, an Automatic save/edit, a switch from Fixed time, and a changed origin or destination request an immediate provider refresh rather than waiting for the schedule. Immediate requests still respect provider spacing and active failure backoff. After a successful or failed check, the central scheduler uses time until **leave**, not time until arrival:

| Time until leave | Adaptive interval | Public OSRM effective interval | Mapbox effective interval |
| --- | ---: | ---: | ---: |
| More than 12 hours | 3 hours | 3 hours | 3 hours |
| 6–12 hours | 1 hour | 1 hour | 1 hour |
| 2–6 hours | 30 minutes | 30 minutes | 30 minutes |
| 30–120 minutes | 10 minutes | 10 minutes | 10 minutes |
| 10–30 minutes | 4 minutes | 5 minutes | 4 minutes |
| Under 10 minutes | 1 minute | 5 minutes | 1 minute |
| Leave time passed | Stop | Stop | Stop |

Mapbox's documented Directions API limit is much higher than this schedule, but Departures still uses a conservative one-minute per-departure floor and one-second global request spacing. Public OSRM never adopts the nominal one-minute near-departure cadence. A single scheduler scans departures and sleeps on the normal service tick; rows do not own timers or generate independent wakeups.

Routes are keyed by provider, mode, and coordinates rounded to five decimals. At most 100 persisted entries are retained. A failed request may use a cache entry up to seven days old. Retryable failures back off five minutes, rate limits fifteen minutes, invalid credentials one hour, and deterministic no-route/not-found failures one day. `Refresh now` reports a temporary pause instead of bypassing these protections.

## Dynamic adjustment

- Increases apply immediately when at least 3 minutes and 10% material.
- Decreases require at least 5 minutes/10% and two consistent observations within 2 minutes of one another.
- Smaller changes are displayed as observations but do not move leave time.
- The preserved `manualTravelMinutes` value remains separate from accepted `autoTravelMinutes`.
- Route refreshes do not increment the user-edit revision, so GET READY and LEAVE NOW remain deduplicated.
- Fixed-time departures discard queued provider work and ignore any in-flight result.

## Failure matrix

DNS failure, timeout, malformed JSON, no result, no route, HTTP error, rate limit, and invalid credentials produce normalized failures. None can prevent state hydration, CRUD, timing, notifications, or panel rendering. Automatic timing falls back through fresh cache, bounded stale cache, remembered place duration, then its stored automatic fallback. Fixed time stays unchanged throughout.

Failure severity follows user impact:

- A saved or fixed duration is available: informational presentation, normal next action, no red styling.
- Routing is temporarily unavailable but recovery may help: a human explanation and Retry/Edit locations appear in details.
- No usable duration exists: blocking presentation, no calculated leave time, and no timing notification until repaired.

Provider names, raw errors, cache state, and technical status appear only inside the optional Routing details section. A manual `departures retry <id>` IPC/CLI action is also available for Automatic departures.
