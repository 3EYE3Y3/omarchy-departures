# Contributing

Departures stays deliberately narrow: given a required arrival time and manual durations, make get-ready and leave time unmistakable. Changes that turn it into a calendar, task manager, route planner, or general dashboard are outside the v0.x product boundary.

Before opening a pull request, run:

```bash
scripts/quality
```

Keep deterministic behavior in the pure JavaScript modules and cover it with Node's built-in test runner. Keep persistence and notifications in the service, and keep QML views focused on presentation and input.
