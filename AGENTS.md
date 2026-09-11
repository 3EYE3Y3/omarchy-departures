# Repository instructions

## Permanent public-data privacy rule

Never use a user's persisted Departures state as source material for screenshots, demos, documentation, fixtures, acceptance captures, release assets, or marketplace assets. Public material must contain only clearly fictional generic information, such as `Morning Meeting`, `Central Office`, `123 Example Street`, `City Dental Clinic`, or `45 Sample Road`.

Never commit, print, upload, or publish real addresses, saved places, coordinates, personal names, routines, destinations, appointments, travel history, or other identifying location data. This applies to all future automated work as well as human contributions.

When live or visual acceptance needs departures:

1. Treat the user's state file as opaque private data.
2. Stop or isolate the shell before changing state, copy the state file to a private temporary backup without displaying its contents, and use a separate fictional demo state.
3. Do not capture the desktop until the isolated fictional state is active.
4. Restore the original state byte-for-byte, remove the temporary state and captures, restart the shell, and verify the restored file checksum.
5. Manually inspect every image before committing or uploading it.

Do not submit or publish this plugin to the Omarchy marketplace unless the user explicitly requests that separate action.
