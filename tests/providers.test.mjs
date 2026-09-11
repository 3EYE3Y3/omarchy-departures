import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Providers = loadQmlJs(new URL("../js/providers.js", import.meta.url))

test("normalizes Nominatim into a vendor-neutral place", () => {
  const result = Providers.normalizeNominatim(JSON.stringify([{ lat: "10.5", lon: "20.5", display_name: "City Dental Clinic, 45 Sample Road", osm_type: "way", osm_id: 42 }]))
  assert.equal(result.ok, true)
  assert.deepEqual({ ...result.value.coordinates }, { latitude: 10.5, longitude: 20.5 })
  assert.equal(result.value.providerId, "way42")
})

test("Nominatim malformed and empty responses fail gracefully", () => {
  assert.equal(Providers.normalizeNominatim("not json").error.code, "malformed_response")
  assert.equal(Providers.normalizeNominatim("[]").error.code, "not_found")
})

test("normalizes OSRM route duration and distance", () => {
  const result = Providers.normalizeOsrm({ code: "Ok", routes: [{ duration: 1841, distance: 20123.4 }] })
  assert.equal(result.ok, true)
  assert.equal(result.value.travelMinutes, 31)
  assert.equal(result.value.distanceMeters, 20123)
  assert.equal(result.value.trafficAware, false)
})

test("OSRM provider errors never throw", () => {
  const noRoute = Providers.normalizeOsrm({ code: "NoRoute", message: "Impossible route between points" })
  assert.equal(noRoute.ok, false)
  assert.equal(noRoute.error.code, "no_route")
  assert.equal(Providers.normalizeOsrm({ code: "Ok", routes: [{ duration: "bad" }] }).error.code, "malformed_response")
})

test("normalizes Mapbox live and typical traffic duration", () => {
  const result = Providers.normalizeMapbox({ code: "Ok", routes: [{ duration: 2580, duration_typical: 1860, distance: 24000 }] })
  assert.equal(result.value.travelMinutes, 43)
  assert.equal(result.value.typicalMinutes, 31)
  assert.equal(result.value.trafficDelayMinutes, 12)
  assert.equal(result.value.trafficAware, true)
})

test("invalid Mapbox credentials are a non-retryable normalized failure", () => {
  const result = Providers.normalizeMapbox({ code: "Unauthorized", message: "Not Authorized" })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, "invalid_credentials")
  assert.equal(result.error.retryable, false)
  assert.equal(Providers.normalizeMapbox({ message: "Not Authorized - Invalid Token" }).error.code, "invalid_credentials")
})

test("request builders validate capability and encode input", () => {
  assert.match(Providers.nominatimRequest("City Dental Clinic").url, /City%20Dental%20Clinic/)
  assert.equal(Providers.osrmRequest({ latitude: 10, longitude: 20 }, { latitude: 11, longitude: 21 }, "walk"), null)
  assert.equal(Providers.mapboxRequest({ latitude: 10, longitude: 20 }, { latitude: 11, longitude: 21 }, "drive", ""), null)
})

test("OSRM serializes longitude before latitude and rejects an obvious swapped coordinate", () => {
  const request = Providers.osrmRequest({ latitude: 10, longitude: 20 }, { latitude: 11, longitude: 21 }, "drive")
  assert.match(request.url, /driving\/20\.000000,10\.000000;21\.000000,11\.000000/)
  assert.equal(Providers.coordinatePair({ latitude: 115, longitude: -31 }), "")
})

test("credential absence leaves zero-key capabilities intact", () => {
  const status = Providers.providerStatus({ networkEnabled: true }, "", null)
  assert.equal(status.routing, "OSRM / OpenStreetMap")
  assert.equal(status.traffic, "Not configured")
})

test("network failures classify DNS, timeout, credentials, and rate limits", () => {
  assert.equal(Providers.networkFailure("osrm", 6, "").error.code, "dns_failure")
  assert.equal(Providers.networkFailure("osrm", 28, "").error.code, "timeout")
  assert.equal(Providers.networkFailure("mapbox", 22, "HTTP 401").error.code, "invalid_credentials")
  assert.equal(Providers.networkFailure("mapbox", 22, "HTTP 429").error.code, "rate_limited")
})
