# Contributing

Departures stays deliberately narrow: given a required arrival time and manual durations, make get-ready and leave time unmistakable. Changes that turn it into a calendar, task manager, route planner, or general dashboard are outside the v0.x product boundary.

Before opening a pull request, run:

```bash
scripts/quality
```

Keep deterministic behavior in the pure JavaScript modules and cover it with Node's built-in test runner. Keep persistence and notifications in the service, and keep QML views focused on presentation and input.

## Public-data privacy rule

Every screenshot, demo, fixture, documentation example, release image, and other public asset must contain only clearly fictional generic information. Never use a contributor's persisted Departures state, saved places, real addresses, precise personal coordinates, names, routines, travel history, or appointments.

Use an isolated temporary state directory for visual or live acceptance data. Examples such as `Morning Meeting`, `Central Office`, `123 Example Street`, `City Dental Clinic`, and `45 Sample Road` are suitable. Preserve the user's real state before testing, restore it afterward, remove the temporary state, and manually inspect every image before it is committed or uploaded. State files and other private data must never be committed.
