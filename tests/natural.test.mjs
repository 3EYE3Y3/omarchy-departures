import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Natural = loadQmlJs(new URL("../js/natural.js", import.meta.url))
const now = new Date(2026, 8, 11, 10, 0).getTime()

test("parses the product's canonical natural departure", () => {
  const result = Natural.parse("Dentist tomorrow at 2pm at Example Clinic", now)
  assert.equal(result.ok, true)
  assert.equal(result.value.title, "Dentist")
  assert.equal(result.value.destination, "Example Clinic")
  assert.equal(new Date(result.value.arrivalTime).getDate(), 12)
  assert.equal(new Date(result.value.arrivalTime).getHours(), 14)
})
test("parses weekday, 24-hour time, and destination", () => {
  const result = Natural.parse("Hockey Friday at 18:30 at Example Ice Arena", now)
  assert.equal(result.ok, true)
  assert.equal(result.value.title, "Hockey")
  assert.equal(result.value.destination, "Example Ice Arena")
})

test("time without a date selects the next occurrence", () => {
  const result = Natural.parse("Gym at 9am at Example Fitness", now)
  assert.equal(new Date(result.value.arrivalTime).getDate(), 12)
})

test("reports only missing deterministic fields", () => {
  const result = Natural.parse("Dentist tomorrow", now)
  assert.equal(result.ok, false)
  assert.ok(Array.from(result.missing).includes("time"))
  assert.ok(Array.from(result.missing).includes("destination"))
})

test("rejects empty input without throwing", () => {
  assert.equal(Natural.parse("", now).missing[0], "description")
})
