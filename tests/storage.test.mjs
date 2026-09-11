import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Storage = loadQmlJs(new URL("../js/storage.js", import.meta.url))

test("migrates v0.1 schema without altering departure or notification data", () => {
  const legacy = { schemaVersion: 1, departures: [{ id: "legacy", title: "Work" }], sentNotifications: { "legacy:1:ready": 10 } }
  const decoded = Storage.decode(JSON.stringify(legacy))
  assert.equal(decoded.ok, true)
  assert.equal(decoded.migrated, true)
  assert.equal(decoded.value.schemaVersion, 2)
  assert.equal(decoded.value.departures[0].id, "legacy")
  assert.equal(decoded.value.sentNotifications["legacy:1:ready"], 10)
  assert.deepEqual(Array.from(decoded.value.places), [])
})
test("restores v0.2 state and defaults missing collections safely", () => {
  const decoded = Storage.decode('{"schemaVersion":2,"departures":[]}')
  assert.equal(decoded.ok, true)
  assert.deepEqual({ ...decoded.value.routeCache }, {})
  assert.deepEqual({ ...decoded.value.settings }, {})
})

test("invalid JSON and unsupported future schemas do not throw", () => {
  assert.equal(Storage.decode("broken").ok, false)
  assert.equal(Storage.decode('{"schemaVersion":99}').ok, false)
})
