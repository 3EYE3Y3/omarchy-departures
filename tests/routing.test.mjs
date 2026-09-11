import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Routing = loadQmlJs(new URL("../js/routing.js", import.meta.url))

test("cache keys are stable at five coordinate decimals", () => {
  const first = Routing.cacheKey({ latitude: 10.000001, longitude: 20.000001 }, { latitude: 10.5, longitude: 20.5 }, "drive", "osrm")
  const second = Routing.cacheKey({ latitude: 10.000002, longitude: 20.000002 }, { latitude: 10.5, longitude: 20.5 }, "drive", "osrm")
  assert.equal(first, second)
  assert.equal(Routing.cacheReferences(first, { latitude: 10, longitude: 20 }), true)
  assert.equal(Routing.cacheReferences(first, { latitude: 0, longitude: 0 }), false)
})
test("route cache serves fresh and bounded stale entries", () => {
  const now = Date.now()
  const entry = Routing.cacheEntry({ ok: true, provider: "osrm", value: { travelMinutes: 31 } }, now, 60000)
  const cache = Routing.put({}, "route", entry, 100)
  assert.equal(Routing.cached(cache, "route", now + 1000, false).stale, false)
  assert.equal(Routing.cached(cache, "route", now + 120000, false), null)
  assert.equal(Routing.cached(cache, "route", now + 120000, true).stale, true)
  assert.equal(Routing.cached(cache, "route", now + 8 * 86400000, true), null)
})

test("refresh cadence becomes more frequent near leave time", () => {
  assert.equal(Routing.refreshInterval(8 * 86400000), Infinity)
  assert.equal(Routing.refreshInterval(2 * 86400000), 6 * 3600000)
  assert.equal(Routing.refreshInterval(60 * 60000), 15 * 60000)
  assert.equal(Routing.refreshInterval(5 * 60000), 2 * 60000)
  assert.equal(Routing.refreshInterval(-1), Infinity)
})

test("material increases apply immediately while small changes are ignored", () => {
  const departure = { travelMinutes: 31, routeTravelMinutes: 31 }
  assert.equal(Routing.considerAdjustment(departure, 33).accepted, false)
  assert.equal(Routing.considerAdjustment(departure, 43).accepted, true)
})

test("material decreases require two consistent observations", () => {
  const departure = { travelMinutes: 40, routeTravelMinutes: 40 }
  const first = Routing.applyResult(departure, { ok: true, provider: "mapbox", value: { travelMinutes: 31 } }, 1)
  assert.equal(first.adjusted, false)
  assert.equal(first.departure.routeCandidateSamples, 1)
  const second = Routing.applyResult(first.departure, { ok: true, provider: "mapbox", value: { travelMinutes: 32 } }, 2)
  assert.equal(second.adjusted, true)
  assert.equal(second.departure.routeTravelMinutes, 32)
})

test("provider failure preserves timing and records fallback state", () => {
  const departure = { travelMinutes: 30, routeTravelMinutes: 35 }
  const applied = Routing.applyResult(departure, { ok: false, error: { message: "timeout" } }, 20)
  assert.equal(applied.departure.routeTravelMinutes, 35)
  assert.equal(applied.departure.routeStatus, "fallback")
})

test("navigation handoff builds an encoded Maps URL without a key", () => {
  const url = Routing.navigationUrl({ origin: "Home & Office", destination: "Example Clinic", transportMode: "drive" })
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/)
  assert.match(url, /origin=Home%20%26%20Office/)
  assert.match(url, /destination=Example%20Clinic/)
})
