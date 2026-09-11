import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Weather = loadQmlJs(new URL("../js/weather.js", import.meta.url))

test("weather provider architecture is disabled without affecting core operation", () => {
  assert.equal(Weather.unavailable().available, false)
})
test("future weather providers normalize into the vendor-neutral contract", () => {
  const result = Weather.normalize("mock", { observedAt: 10, rainProbability: 110, temperatureC: 32, summary: "Hot" })
  assert.equal(result.ok, true)
  assert.equal(result.value.rainProbability, 100)
  assert.equal(result.value.temperatureC, 32)
  assert.equal(Weather.normalize("mock", {}).ok, false)
})
