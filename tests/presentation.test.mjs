import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Presentation = loadQmlJs(new URL("../js/presentation.js", import.meta.url))

test("route failure with fixed timing remains calm and reliable", () => {
  const departure = { timingMode: "manual", manualTravelMinutes: 25, autoTravelMinutes: 31, routeStatus: "fallback", routeErrorCode: "no_route" }
  assert.equal(Presentation.hasUsableTiming(departure), true)
  assert.equal(Presentation.travelLine(departure), "Travel 25 min · Fixed time")
  assert.equal(Presentation.impact(departure).level, "normal")
})

test("route failure with an automatic fallback uses informational saved-time wording", () => {
  const departure = { timingMode: "auto", manualTravelMinutes: null, autoTravelMinutes: 25, routeStatus: "fallback", routeErrorCode: "no_route" }
  assert.equal(Presentation.travelLine(departure), "Travel 25 min · Saved")
  assert.deepEqual({ ...Presentation.impact(departure) }, {
    level: "informational",
    title: "Using saved travel time",
    message: "Using saved 25 min travel time",
  })
  assert.doesNotMatch(Presentation.impact(departure).message, /impossible|OSRM|provider/i)
})

test("route failure without usable timing is a blocking error", () => {
  const departure = { timingMode: "auto", manualTravelMinutes: null, autoTravelMinutes: null, routeStatus: "fallback", routeErrorCode: "no_route" }
  assert.equal(Presentation.hasUsableTiming(departure), false)
  assert.equal(Presentation.impact(departure).level, "blocking")
  assert.equal(Presentation.impact(departure).title, "Departure time cannot be calculated")
})

test("routing diagnostics retain a human explanation outside the primary card", () => {
  const departure = { timingMode: "auto", autoTravelMinutes: 25, routeStatus: "fallback", routeErrorCode: "no_route" }
  assert.equal(Presentation.routingTitle(departure), "Automatic routing unavailable")
  assert.match(Presentation.routingExplanation(departure), /could not calculate a driving route/)
})

test("arrival labels and timing sources use ordinary language", () => {
  const now = new Date(2026, 8, 11, 12).getTime()
  const tomorrow = new Date(2026, 8, 12, 7, 30).getTime()
  assert.equal(Presentation.arrivalLabel(tomorrow, now), "Tomorrow · 07:30")
  assert.equal(Presentation.timingSource({ timingMode: "auto", autoTravelMinutes: 20, routeStatus: "live", routeTrafficAware: true }), "Live estimate")
})
