# Routing diagnostics

## Observed symptom

The primary panel could show `Impossible route between points; using remembered/manual timing` next to a valid next action. It also permanently displayed provider and traffic-configuration text. The route warning came from an OSRM `NoRoute` response while a saved automatic or manual duration still made the calculated leave time reliable.

The persisted state was inspected without printing or copying its private location values. Both endpoints contained valid latitude/longitude objects. The app-generated request was replayed privately using the same pair and currently returned an OSRM `Ok` route. OSRM's nearest-point endpoint also accepted both points, with small snap distances. No matching historical shell-log entry was retained.

## Root cause

There were two distinct findings:

1. The historical route result was a real provider `NoRoute` classification. Current code serialized each point as `longitude,latitude`, separated the points correctly, selected the driving profile, and built a valid URL. Schema-v2/v3 migration did not reorder or mutate coordinates. The same saved pair is currently routable. Available evidence therefore classifies the original route result as a transient/provider or point-accessibility limitation, not coordinate inversion, malformed request construction, or destructive migration.
2. The application did have a presentation bug: it copied the provider's raw technical message into prominent panel status even though the departure retained a reliable fallback duration. Backend severity was being treated as user-impact severity.

The exact historical external condition cannot be reconstructed after the provider recovered and no response body was retained. A future repeated `NoRoute` for the same unchanged endpoints would indicate provider map/profile accessibility rather than timing corruption; Edit locations remains available for that case.

## Fix

- Normalize OSRM `NoRoute` to the stable internal code `no_route` and persist the code separately from its technical message.
- Regression-test longitude-before-latitude serialization and rejection of obviously swapped coordinates.
- Keep a failed refresh in explicit fallback state, including when a bounded stale route is used.
- Map route state through a presentation layer based on whether the user can still rely on the timing.
- Remove provider identity, traffic configuration, and raw errors from the primary card.
- Put the human explanation, raw diagnostic detail, Retry, and Edit locations in the details view.
- Preserve an otherwise valid departure with no duration so it can be repaired; do not fabricate a zero-minute journey or emit notifications for it.

## Expected fallback behaviour

When a Fixed time or saved Automatic duration exists, the destination, next action, leave time, and travel duration remain normal. The panel may subtly say `Using saved 25 min travel time`; it does not show the raw provider error or red styling.

When no usable duration exists, Departures shows `Departure time cannot be calculated`, omits the leave time, suppresses timing notifications, and directs the user to add a duration or edit the locations. This is the only routing-related condition that becomes a blocking red state.

All examples here are generic fictional data. No user addresses, coordinates, saved places, appointments, or other personal information were copied into this document.
