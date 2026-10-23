import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import vm from "node:vm"
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

const serviceSource = fs.readFileSync(new URL("../Service.qml", import.meta.url), "utf8")
const startNetworkSource = serviceSource.slice(serviceSource.indexOf("    function startNextNetwork()"),
  serviceSource.indexOf("    function networkFailure("))
const networkStartedSource = serviceSource.match(/id: networkProcess[\s\S]*?onStarted: \{([\s\S]*?)\n        \}/)[1]

for (const provider of ["mapbox", "osrm", "nominatim"]) {
  test(`${provider} sends its URL only through curl stdin, including consecutive requests`, () => {
    const origin = { latitude: 10, longitude: 20 }
    const destination = { latitude: 11, longitude: 21 }
    const request = provider === "mapbox" ? Providers.mapboxRequest(origin, destination, "drive", "fictional-token")
      : provider === "osrm" ? Providers.osrmRequest(origin, destination, "drive")
      : Providers.nominatimRequest("123 Example Street", "")
    const writes = []
    const networkProcess = {
      running: false,
      stdinEnabled: false,
      write(value) {
        assert.equal(this.stdinEnabled, true)
        writes.push(value)
      },
    }
    const context = vm.createContext({
      Providers, networkProcess, settings: { networkEnabled: true, countryCodes: "" },
      lastNominatimAt: 0, lastProviderRequestAt: {}, routeRequestCount: 0,
      activeNetworkJob: null,
    })
    context.service = context
    vm.runInContext(startNetworkSource, context)
    for (let i = 0; i < 2; i++) {
      context.networkQueue = [{ kind: request.kind, provider, request, query: "123 Example Street" }]
      context.lastNominatimAt = 0
      context.lastProviderRequestAt = {}
      networkProcess.running = false
      vm.runInContext("startNextNetwork()", context)
      assert.equal(networkProcess.running, true)
      assert.equal(networkProcess.stdinEnabled, true)
      assert.deepEqual(Array.from(networkProcess.command), [
        "curl", "--silent", "--show-error", "--fail-with-body", "--max-time", "8",
        "--connect-timeout", "3", "--user-agent", request.userAgent, "--config", "-",
      ])
      vm.runInContext(networkStartedSource, context)
      assert.equal(networkProcess.stdinEnabled, false)
      assert.equal(writes[i], `url = "${request.url}"\n`)
    }
  })
}

test("curl config quotes URLs and escapes config delimiters and control characters", () => {
  const url = 'https://example.invalid/"\\\nurl = "injected\r\t\v'
  assert.equal(Providers.curlConfig({ url }),
    'url = "https://example.invalid/\\"\\\\\\nurl = \\"injected\\r\\t\\v"\n')
})
