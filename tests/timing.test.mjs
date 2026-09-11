import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Timing = loadQmlJs(new URL("../js/timing.js", import.meta.url))

function departure(arrivalTime, overrides = {}) {
  return {
    id: "one",
    title: "Morning meeting",
    destination: "Central Office",
    arrivalTime,
    timingMode: "auto",
    manualTravelMinutes: 18,
    autoTravelMinutes: 23,
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
  const result = Timing.derive(departure(event, { autoTravelMinutes: 0 }))
  assert.equal(result.leaveTime, result.targetArrivalTime)
})

test("arrival-first calculation includes parking and walking before safety arrival", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const result = Timing.derive(departure(event, { autoTravelMinutes: 30, parkingMinutes: 5, walkingMinutes: 8, arrivalBufferMinutes: 10 }))
  assert.equal(Timing.localTime(result.targetArrivalTime), "18:20")
  assert.equal(Timing.localTime(result.routeArrivalTime), "18:07")
  assert.equal(Timing.localTime(result.leaveTime), "17:37")
})

test("automatic duration is authoritative without changing the preserved manual value", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const dep = departure(event, { manualTravelMinutes: 31, autoTravelMinutes: 43 })
  const result = Timing.derive(dep)
  assert.equal(result.effectiveTravelMinutes, 43)
  assert.equal(dep.manualTravelMinutes, 31)
})

test("manual duration is authoritative even when automatic data exists", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const result = Timing.derive(departure(event, { timingMode: "manual", manualTravelMinutes: 25, autoTravelMinutes: 43 }))
  assert.equal(result.effectiveTravelMinutes, 25)
  assert.equal(Timing.localTime(result.leaveTime), "17:55")
})

test("auto to manual seeds from effective timing and switching back restores automatic authority", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const automatic = departure(event, { manualTravelMinutes: undefined, autoTravelMinutes: 27 })
  const seeded = Timing.manualTravelMinutesForSwitch(automatic)
  assert.equal(seeded, 27)
  const manual = { ...automatic, timingMode: "manual", manualTravelMinutes: seeded }
  assert.equal(Timing.derive(manual).effectiveTravelMinutes, 27)
  manual.manualTravelMinutes = 25
  assert.equal(Timing.derive(manual).effectiveTravelMinutes, 25)
  const backToAutomatic = { ...manual, timingMode: "auto" }
  assert.equal(Timing.derive(backToAutomatic).effectiveTravelMinutes, 27)
  assert.equal(backToAutomatic.manualTravelMinutes, 25)
})

test("a null uninitialized manual value seeds from refreshed automatic timing", () => {
  const event = new Date(2026, 8, 11, 18, 30).getTime()
  const automatic = departure(event, { manualTravelMinutes: null, autoTravelMinutes: 37 })
  assert.equal(Timing.manualTravelMinutesForSwitch(automatic), 37)
})

test("sorts multiple departures and selects the next unexpired one", () => {
  const now = new Date(2026, 8, 11, 12, 0).getTime()
  const later = departure(now + 5 * 3600000, { id: "later" })
  const sooner = departure(now + 2 * 3600000, { id: "sooner" })
  const past = departure(now - 1, { id: "past" })
  assert.deepEqual(Array.from(Timing.sortDepartures([later, past, sooner]), item => item.id), ["past", "sooner", "later"])
  assert.equal(Timing.nextDeparture([later, past, sooner], now).id, "sooner")
})

test("next action selects the earliest preparation boundary, not merely earliest arrival", () => {
  const now = new Date(2026, 8, 11, 12, 0).getTime()
  const earlierArrival = departure(now + 3 * 3600000, { id: "earlier", preparationMinutes: 10, autoTravelMinutes: 10 })
  const actionableFirst = departure(now + 4 * 3600000, { id: "actionable", preparationMinutes: 120, autoTravelMinutes: 60 })
  assert.equal(Timing.nextActionDeparture([earlierArrival, actionableFirst], now).id, "actionable")
  assert.equal(Timing.snapshot([earlierArrival, actionableFirst], now).next.id, "actionable")
})

test("handles future dates and next-action guidance", () => {
  const now = new Date(2026, 8, 11, 10, 0).getTime()
  const tomorrow = departure(new Date(2026, 8, 12, 18, 30).getTime())
  assert.equal(Timing.nextAction(tomorrow, now), "Next departure tomorrow at 18:30")
})

test("handles a departure across midnight", () => {
  const event = new Date(2026, 8, 12, 0, 20).getTime()
  const result = Timing.derive(departure(event, { autoTravelMinutes: 30, arrivalBufferMinutes: 5, preparationMinutes: 20 }))
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
  assert.match(Timing.nextAction(dep, times.getReadyTime - 60000), /^Get ready for Morning meeting in /)
  assert.match(Timing.nextAction(dep, times.getReadyTime), /^Leave for Morning meeting in /)
  assert.equal(Timing.nextAction(dep, times.leaveTime), "Leave now for Morning meeting")
  assert.equal(Timing.nextAction(dep, times.targetArrivalTime), "You should already be on your way")
  assert.equal(Timing.nextAction(null, times.leaveTime), "No upcoming departures")
})

test("strict local date parsing rejects rolled-over dates", () => {
  assert.ok(Number.isFinite(Timing.localDateTime("2026-09-11", "18:30")))
  assert.ok(Number.isNaN(Timing.localDateTime("2026-02-31", "18:30")))
  assert.ok(Number.isNaN(Timing.localDateTime("2026-09-11", "24:00")))
})

test("missing timing is explicit and never fabricates a departure time", () => {
  const now = new Date(2026, 8, 11, 12, 0).getTime()
  const degraded = departure(now + 3600000, { autoTravelMinutes: null, manualTravelMinutes: null })
  const result = Timing.derive(degraded)
  assert.equal(result.timingReliable, false)
  assert.equal(Number.isNaN(result.effectiveTravelMinutes), true)
  assert.equal(Timing.status(degraded, now), "NEEDS ATTENTION")
  assert.equal(Timing.nextAction(degraded, now), "Departure time needs attention")
  assert.equal(Timing.isExpired({ ...degraded, arrivalTime: now - 1 }, now), true)
})
