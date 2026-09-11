import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Places = loadQmlJs(new URL("../js/places.js", import.meta.url))
const Kits = loadQmlJs(new URL("../js/kits.js", import.meta.url))
const Location = loadQmlJs(new URL("../js/location.js", import.meta.url))

test("saved places are learned implicitly and matched case-insensitively", () => {
  const places = Places.learn([], { destination: "City Dental Clinic", manualTravelMinutes: 30, arrivalBufferMinutes: 10, parkingMinutes: 5, walkingMinutes: 4, preparationMinutes: 20 }, 1)
  assert.equal(places.length, 1)
  assert.equal(Places.find(places, "city dental clinic").normalTravelMinutes, 30)
})

test("saved place learning smooths ordinary repeated values", () => {
  let places = Places.learn([], { destination: "Central Office", manualTravelMinutes: 30, arrivalBufferMinutes: 10, parkingMinutes: 4, walkingMinutes: 3, preparationMinutes: 20 }, 1)
  places = Places.learn(places, { destination: "Central Office", manualTravelMinutes: 40, arrivalBufferMinutes: 12, parkingMinutes: 6, walkingMinutes: 5, preparationMinutes: 30 }, 2)
  assert.equal(Places.find(places, "Central Office").normalTravelMinutes, 35)
  assert.equal(Places.find(places, "Central Office").samples, 2)
})

test("geocoding updates a place without duplicating it", () => {
  let places = Places.learn([], { destination: "Central Office", manualTravelMinutes: 30 }, 1)
  places = Places.withGeocode(places, "Central Office", { coordinates: { latitude: 10, longitude: 20 }, label: "123 Example Street" }, 2)
  assert.equal(places.length, 1)
  assert.equal(Places.find(places, "Central Office").coordinates.latitude, 10)
})

test("observed routes refine a remembered normal duration", () => {
  let places = Places.learn([], { destination: "Central Office", manualTravelMinutes: 30 }, 1)
  places = Places.observeRoute(places, "Central Office", 40, 2)
  places = Places.observeRoute(places, "Central Office", 42, 3)
  assert.equal(Places.find(places, "Central Office").normalTravelMinutes, 41)
  assert.equal(Places.find(places, "Central Office").routeSamples, 2)
})

test("built-in bring kits need no setup and learned kits override them", () => {
  assert.deepEqual(Array.from(Kits.suggested([], "Work", "custom").items), ["Laptop", "Charger", "ID", "Lunch"])
  const learned = Kits.learn([], "work", ["Laptop", "Keys"], 1)
  assert.deepEqual(Array.from(Kits.suggested(learned, "Work", "work").items), ["Laptop", "Keys"])
})

test("custom activity kits can be reset", () => {
  const learned = Kits.learn([], "Dentist", ["Health card"], 1)
  assert.equal(Kits.suggested(learned, "Dentist", "custom").items[0], "Health card")
  assert.equal(Kits.remove(learned, "Dentist").length, 0)
})

test("ephemeral current location validates coordinates and stores no history", () => {
  const result = Location.ephemeral("10.5,20.5", "Current", 10)
  assert.equal(result.ok, true)
  assert.deepEqual({ ...result.value.coordinates }, { latitude: 10.5, longitude: 20.5 })
  assert.equal(Location.ephemeral("999,1", "", 10).ok, false)
})
