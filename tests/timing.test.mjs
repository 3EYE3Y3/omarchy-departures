import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Timing = loadQmlJs(new URL("../js/timing.js", import.meta.url))

function departure(arrivalTime, overrides = {}) {
  return {
    id: "one",
    title: "Dinner",
    destination: "Example City",
    arrivalTime,
    travelMinutes: 23,
    arrivalBufferMinutes: 10,
    preparationMinutes: 30,
    ...overrides,
  }
}

test("calculates target arrival, leave, and get-ready times", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const result = Timing.derive(departure(event))
  assert.equal(Timing.localTime(result.targetArrivalTime), "18:20")
  assert.equal(Timing.localTime(result.leaveTime), "17:57")
  assert.equal(Timing.localTime(result.getReadyTime), "17:27")
})

test("supports zero preparation", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const result = Timing.derive(departure(event, { preparationMinutes: 0 }))
  assert.equal(result.getReadyTime, result.leaveTime)
})

test("supports zero arrival buffer", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  assert.equal(Timing.derive(departure(event, { arrivalBufferMinutes: 0 })).targetArrivalTime, event)
})

test("supports zero travel duration", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const result = Timing.derive(departure(event, { travelMinutes: 0 }))
  assert.equal(result.leaveTime, result.targetArrivalTime)
})

test("sorts multiple departures and selects the next unexpired one", () => {
  const now = new Date(2026, 8, 11, 12, 0).getTime()
  const later = departure(now + 5 * 3600000, { id: "later" })
  const sooner = departure(now + 2 * 3600000, { id: "sooner" })
  const past = departure(now - 1, { id: "past" })
  assert.deepEqual(Array.from(Timing.sortDepartures([later, past, sooner]), item => item.id), ["past", "sooner", "later"])
  assert.equal(Timing.nextDeparture([later, past, sooner], now).id, "sooner")
})

test("handles future dates and next-action guidance", () => {
  const now = new Date(2026, 8, 11, 10, 0).getTime()
  const tomorrow = departure(new Date(2026, 8, 12, 18, 30).getTime())
  assert.equal(Timing.nextAction(tomorrow, now), "NEXT DEPARTURE TOMORROW 18:30")
})

test("handles a departure across midnight", () => {
  const event = new Date(2026, 8, 12, 0, 20).getTime()
  const result = Timing.derive(departure(event, { travelMinutes: 30, arrivalBufferMinutes: 5, preparationMinutes: 20 }))
  assert.equal(Timing.localDate(result.leaveTime), "2026-09-11")
  assert.equal(Timing.localTime(result.leaveTime), "23:45")
  assert.equal(Timing.localTime(result.getReadyTime), "23:25")
})

test("moves through status transitions and expires after event time", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const dep = departure(event)
  const times = Timing.derive(dep)
  assert.equal(Timing.status(dep, times.getReadyTime - 1), "ON TIME")
  assert.equal(Timing.status(dep, times.getReadyTime), "GET READY")
  assert.equal(Timing.status(dep, times.leaveTime - 5 * 60000), "LEAVE SOON")
  assert.equal(Timing.status(dep, times.leaveTime), "LEAVE NOW")
  assert.equal(Timing.status(dep, times.targetArrivalTime), "DEPARTED")
  assert.equal(Timing.status(dep, times.eventTime + 1), "EXPIRED")
})

test("next action changes at get-ready and leave boundaries", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const dep = departure(event)
  const times = Timing.derive(dep)
  assert.match(Timing.nextAction(dep, times.getReadyTime - 60000), /^GET READY IN /)
  assert.match(Timing.nextAction(dep, times.getReadyTime), /^LEAVE FOR DINNER IN /)
  assert.equal(Timing.nextAction(dep, times.leaveTime), "LEAVE NOW FOR DINNER")
  assert.equal(Timing.nextAction(null, times.leaveTime), "NO UPCOMING DEPARTURES")
})

test("strict local date parsing rejects rolled-over dates", () => {
  assert.ok(Number.isFinite(Timing.localDateTime("2026-09-11", "18:30")))
  assert.ok(Number.isNaN(Timing.localDateTime("2026-02-31", "18:30")))
  assert.ok(Number.isNaN(Timing.localDateTime("2026-09-11", "24:00")))
})
