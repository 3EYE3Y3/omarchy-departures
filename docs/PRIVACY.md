# Privacy

Departures defaults to local-only operation. It has no analytics, telemetry, account, cloud backend, calendar upload, or location history.

Departure data, learned places, bring kits, settings, deduplication keys, and route cache are stored only in the user's XDG state directory. The file is atomically written with mode `0600`. Desktop notifications are delivered through Omarchy's local notification command.

External network routing is disabled by default. If the user enables it:

- Destination/origin text is sent to Nominatim only when coordinates are unknown.
- Origin and destination coordinates, transport mode, and a minimal route request are sent to OSRM or configured Mapbox.
- No event title, reminder items, notes, arrival time, or departure history is sent.
- Provider responses are cached locally to avoid repeat disclosure and requests.
- Mapbox credentials are read from environment and never persisted.

An explicitly supplied current-location coordinate is held in service memory for the current shell session. It is used directly for routing, is not copied into departures or places, and disappears on reload. A saved-place or manual origin remains the privacy-preserving default.

The `ROUTE` action opens a Google Maps URL in the user's browser. That handoff is user-initiated and becomes subject to the browser/navigation provider's privacy terms.

## Screenshots, demos, and public assets

Public screenshots, promotional images, README/release images, demo data, documentation examples, and public test fixtures must use only clearly fictional generic information. They must never expose real addresses, saved places, coordinates, names, routines, travel history, or appointments.

Visual acceptance must run against an isolated temporary state directory populated with examples such as `Morning Meeting`, `Central Office`, and `123 Example Street`. The user's persisted state must not be captured or replaced. After testing, remove temporary state, restore the normal installation, and inspect every image for personal information before committing or publishing it.
