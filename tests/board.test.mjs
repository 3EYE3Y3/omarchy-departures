import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Board = loadQmlJs(new URL("../js/board.js", import.meta.url))
const Timing = loadQmlJs(new URL("../js/timing.js", import.meta.url))

const now = new Date(2026, 8, 11, 6, 0).getTime()

function departure(id, arrivalTime, destination, overrides = {}) {
  return {
    id,
    title: destination,
    destination,
    arrivalTime,
    timingMode: "auto",
    manualTravelMinutes: null,
    autoTravelMinutes: 25,
    arrivalBufferMinutes: 5,
    preparationMinutes: 15,
    routeStatus: "live",
    routeCheckedAt: now - 3 * 60000,
    ...overrides,
  }
}

function desired(records, at = now) {
  return Board.rows(Timing.snapshot(records, at).upcoming, at)
}

class MockListModel {
  constructor() { this.rows = [] }
  get count() { return this.rows.length }
  get(index) { return this.rows[index] }
  remove(index) { this.rows.splice(index, 1) }
  insert(index, value) { this.rows.splice(index, 0, { ...value }) }
  move(from, to, count) { this.rows.splice(to, 0, ...this.rows.splice(from, count)) }
  setProperty(index, role, value) { this.rows[index][role] = value }
}

test("board shows every upcoming departure in chronological arrival order", () => {
  const todayEarly = departure("early", now + 2 * 3600000, "Central Office")
  const todayLate = departure("late", now + 5 * 3600000, "City Dental Clinic")
  const tomorrow = departure("tomorrow", now + 26 * 3600000, "International Terminal")
  const expired = departure("expired", now - 1, "Old Appointment")
  const rows = desired([tomorrow, expired, todayLate, todayEarly])
  assert.deepEqual(Array.from(rows, row => row.departureId), ["early", "late", "tomorrow"])
  assert.deepEqual(Object.keys({ ...rows[0] }).filter(key => ["arriveText", "destination", "leaveText", "statusText"].includes(key)).sort(),
    ["arriveText", "destination", "leaveText", "statusText"])
})

test("board groups today and tomorrow with compact separators", () => {
  const rows = desired([
    departure("one", now + 2 * 3600000, "Central Office"),
    departure("two", now + 4 * 3600000, "City Dental Clinic"),
    departure("three", now + 26 * 3600000, "International Terminal"),
  ])
  assert.equal(rows[0].showDayHeading, true)
  assert.match(rows[0].dayHeading, /^TODAY · /)
  assert.equal(rows[1].showDayHeading, false)
  assert.equal(rows[2].showDayHeading, true)
  assert.match(rows[2].dayHeading, /^TOMORROW · /)
})

test("identical clock refresh performs no model operation", () => {
  const model = new MockListModel()
  const records = [departure("one", now + 2 * 3600000, "Central Office")]
  assert.equal(Board.syncModel(model, desired(records)).inserted, 1)
  assert.deepEqual({ ...Board.syncModel(model, desired(records, now + 15000)) },
    { inserted: 0, removed: 0, moved: 0, updatedRows: 0, updatedProperties: 0 })
})

test("route refresh patches only the affected row and preserves unrelated row identity", () => {
  const first = departure("one", now + 2 * 3600000, "Central Office")
  const second = departure("two", now + 4 * 3600000, "City Dental Clinic")
  const model = new MockListModel()
  Board.syncModel(model, desired([first, second]))
  const untouched = model.get(1)
  const refreshed = { ...first, autoTravelMinutes: 35, routeCheckedAt: now + 60000 }
  const stats = Board.syncModel(model, desired([refreshed, second], now + 60000))
  assert.equal(stats.inserted, 0)
  assert.equal(stats.removed, 0)
  assert.equal(stats.moved, 0)
  assert.equal(stats.updatedRows, 1)
  assert.equal(model.get(1), untouched)
  assert.notEqual(model.get(0).leaveText, desired([first, second])[0].leaveText)
})

test("expiry removes one row without resetting the remaining board", () => {
  const expiring = departure("one", now + 60000, "Central Office")
  const later = departure("two", now + 4 * 3600000, "City Dental Clinic")
  const model = new MockListModel()
  Board.syncModel(model, desired([expiring, later]))
  const retained = model.get(1)
  const stats = Board.syncModel(model, desired([expiring, later], now + 60001))
  assert.equal(stats.removed, 1)
  assert.equal(stats.inserted, 0)
  assert.equal(model.count, 1)
  assert.equal(model.get(0), retained)
})

test("missing timing becomes a route-needed board row", () => {
  const row = desired([departure("missing", now + 2 * 3600000, "Example Primary School", {
    autoTravelMinutes: null,
    manualTravelMinutes: null,
  })])[0]
  assert.equal(row.leaveText, "—")
  assert.equal(row.statusText, "ROUTE NEEDED")
  assert.equal(row.timingReliable, false)
})
