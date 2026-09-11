# Board stability diagnosis

## Symptom

The v0.3.0 panel appeared to crash, reset, or flicker while it was left open. The effect could coincide with an ordinary countdown update, a provider result, notification state, or an edit. Scroll/focus and row-local state could be lost even though the long-lived service and shell process remained alive.

## Exact cause

This was an application model-identity bug, not a provider crash or shell lifecycle failure.

`Service.qml` runs one normal 15-second clock. Each tick assigned a newly allocated `Timing.snapshot()` object. That snapshot created a new `upcoming` array and new enriched departure objects even when no visible value changed. The v0.3.0 panel bound its primary card and a `Repeater` over `upcoming.slice(1)`, allocating yet another model array. QML consequently treated routine refreshes as replacement models and destroyed/recreated delegates. Provider completion used the same full-snapshot path, amplifying the reset behavior.

Runtime journal inspection during isolated acceptance found no matching Departures `TypeError`, `ReferenceError`, binding failure, or process crash. The visible reset was delegate churn.

## Fix

The service now owns one long-lived QML `ListModel`. `js/board.js` produces explicit row roles and reconciles by stable departure ID:

- unchanged rows receive no model operation;
- one changed route patches only that row's changed roles;
- add/delete/expiry inserts or removes only that ID;
- ordering uses the smallest required move;
- the model is never cleared during refresh or hydration.

The board is a single reusable `ListView`, stays instantiated while details/editor surfaces are shown, and restores its previous clamped scroll position when returning from details. Hydration is one-shot. The route scheduler updates a durable departure record and then reconciles the corresponding board row instead of replacing the board surface.

## Acceptance contract

Automated model tests assert zero operations for an unchanged clock update, one-row mutation for a route result, retained identity for unrelated rows, and one-row removal on expiry. Source-level UI contracts prohibit model clearing and array-backed repeaters. Isolated live acceptance observed an actual second provider request changing Automatic duration and leave time with `updatedRows: 1`, `inserted: 0`, `removed: 0`, and `moved: 0`; a details round trip and shell restart produced no new Departures runtime error.
