import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Storage = loadQmlJs(new URL("../js/storage.js", import.meta.url))

test("migrates v0.1 schema without altering identity or notification data", () => {
  const legacy = { schemaVersion: 1, departures: [{ id: "legacy", title: "Morning meeting", travelMinutes: 18 }], sentNotifications: { "legacy:1:ready": 10 } }
  const decoded = Storage.decode(JSON.stringify(legacy))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.migrated, true)
  assert.equal(decoded.value.schemaVersion, 3)
  assert.equal(decoded.value.departures[0].id, "legacy")
  assert.equal(decoded.value.sentNotifications["legacy:1:ready"], 10)
  assert.deepEqual(Array.from(decoded.value.places), [])
})

test("migrates v0.2 routing authority to explicit auto and manual values", () => {
  const decoded = Storage.decode(JSON.stringify({
    schemaVersion: 2,
    departures: [{ id: "legacy-v2", title: "Airport", travelMinutes: 25, routeTravelMinutes: 34 }],
    places: [{ id: "place-1", name: "International Terminal", address: "International Terminal" }],
    settings: { networkEnabled: true },
  }))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.migrated, true)
  assert.equal(decoded.value.departures[0].timingMode, "auto")
  assert.equal(decoded.value.departures[0].manualTravelMinutes, 25)
  assert.equal(decoded.value.departures[0].autoTravelMinutes, 34)
  assert.equal(Object.hasOwn(decoded.value.departures[0], "travelMinutes"), false)
  assert.equal(decoded.value.places[0].name, "International Terminal")
  assert.equal(decoded.value.settings.networkEnabled, true)
  assert.deepEqual({ ...decoded.value.routeCache }, {})
})

test("reloads schema v3 timing mode and values without migration", () => {
  const decoded = Storage.decode(JSON.stringify({ schemaVersion: 3, departures: [{ id: "current", timingMode: "manual", manualTravelMinutes: 22, autoTravelMinutes: 31 }] }))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.migrated, false)
  assert.equal(decoded.value.departures[0].timingMode, "manual")
  assert.equal(decoded.value.departures[0].manualTravelMinutes, 22)
  assert.equal(decoded.value.departures[0].autoTravelMinutes, 31)
})

test("schema v3 preserves the absence of a previous manual value", () => {
  const decoded = Storage.decode(JSON.stringify({ schemaVersion: 3, departures: [{ id: "auto-only", timingMode: "auto", manualTravelMinutes: null, autoTravelMinutes: 31 }] }))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.value.departures[0].manualTravelMinutes, null)
  assert.equal(decoded.value.departures[0].autoTravelMinutes, 31)
})

test("schema v3 preserves a missing timing value for recoverable degraded UI", () => {
  const decoded = Storage.decode(JSON.stringify({ schemaVersion: 3, departures: [{ id: "needs-timing", timingMode: "auto", manualTravelMinutes: null, autoTravelMinutes: null }] }))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.value.departures[0].manualTravelMinutes, null)
  assert.equal(decoded.value.departures[0].autoTravelMinutes, null)
})

test("invalid JSON and unsupported future schemas do not throw", () => {
  assert.equal(Storage.decode("broken").ok, false)
  assert.equal(Storage.decode('{"schemaVersion":99}').ok, false)
})
