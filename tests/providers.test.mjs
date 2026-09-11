import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Providers = loadQmlJs(new URL("../js/providers.js", import.meta.url))

test("normalizes Nominatim into a vendor-neutral place", () => {
  const result = Providers.normalizeNominatim(JSON.stringify([{ lat: "10.056", lon: "20.748", display_name: "Example Clinic", osm_type: "way", osm_id: 42 }]))
  assert.equal(result.ok, true)
  assert.deepEqual({ ...result.value.coordinates }, { latitude: 10.056, longitude: 20.748 })
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
  assert.equal(Providers.normalizeOsrm({ code: "NoRoute", message: "Impossible" }).ok, false)
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
  assert.match(Providers.nominatimRequest("Example Clinic").url, /Example%20Clinic/)
  assert.equal(Providers.osrmRequest({ latitude: 10, longitude: 20 }, { latitude: 10.5, longitude: 20.5 }, "walk"), null)
  assert.equal(Providers.mapboxRequest({ latitude: 10, longitude: 20 }, { latitude: 10.5, longitude: 20.5 }, "drive", ""), null)
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
