# Departures

> Know when to go.

Departures is a focused departure assistant for Omarchy. Tell it where you need to be and when; it tells you when to get ready, when to leave, and what to remember.

The bar stays compact. The panel uses a high-density passenger-information layout where **LEAVE** is the strongest value. Departures continuously advances through `ON TIME`, `GET READY`, `LEAVE SOON`, `LEAVE NOW`, and `DEPARTED`, and hides an entry once its event time has passed.

## Features

- Manual departures with destination, event time, travel, buffer, preparation, transport, profile, reminders, and notes
- Immediate GET READY, LEAVE, ARRIVE, and EVENT preview while editing
- Live next-action instructions and minute countdowns
- Work, School, Airport, Fishing, Sport, and Shopping presets
- Local GET READY and LEAVE NOW notifications with reload-safe deduplication
- Atomic local persistence under the XDG state directory
- No backend, account, cloud, or external API

## Install

```bash
omarchy plugin add https://github.com/3EYE3Y3/omarchy-departures.git --enable --yes
```

Departures is added to the center bar section by default. Move it if preferred:

```bash
omarchy bar move io.github.3eye3y3.departures --section right
```

Click the bar item to open the board. You can also use shell IPC:

```bash
omarchy-shell shell summon io.github.3eye3y3.departures '{}'
```

## Data

State lives at:

```text
$XDG_STATE_HOME/omarchy/departures/state.json
```

When `XDG_STATE_HOME` is unset, Departures uses `~/.local/state/omarchy/departures/state.json`.

## Development

The test suite has no third-party dependencies:

```bash
npm test
scripts/quality
```

`scripts/quality` runs domain tests, the current Omarchy manifest validator, QML lint when installed, shell syntax checks, ShellCheck when installed, and whitespace validation.

## Scope

Version 0.1 deliberately excludes calendars, live traffic, maps, weather, public transport, flight tracking, cloud synchronization, and AI. Its one job is to make leave time obvious.

## License

MIT
