.pragma library

var USER_AGENT = "Departures/0.2.1 (+https://github.com/3EYE3Y3/omarchy-departures)"

function cleanText(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "")
}

function finite(value) {
    var number = Number(value)
    return isFinite(number) ? number : NaN
}

function coordinates(value) {
    if (!value) return null
    var latitude = finite(value.latitude !== undefined ? value.latitude : value.lat)
    var longitude = finite(value.longitude !== undefined ? value.longitude : value.lon)
    if (!isFinite(latitude) || !isFinite(longitude) || latitude < -90 || latitude > 90
            || longitude < -180 || longitude > 180) return null
    return { latitude: latitude, longitude: longitude }
}

function ok(provider, value, metadata) {
    return { ok: true, provider: provider, value: value, metadata: metadata || {}, error: null }
}

function fail(provider, code, message, retryable, status) {
    return {
        ok: false,
        provider: provider,
        value: null,
        metadata: {},
        error: {
            code: cleanText(code || "provider_error"),
            message: cleanText(message || "Provider request failed"),
            retryable: retryable === true,
            status: Number(status) || 0
        }
    }
}

function networkFailure(provider, exitCode, details) {
    var code = Number(exitCode)
    var text = cleanText(details).toLowerCase()
    if (code === 28) return fail(provider, "timeout", "Provider timed out", true, 0)
    if (code === 6) return fail(provider, "dns_failure", "Provider DNS lookup failed", true, 0)
    if (text.indexOf("401") !== -1 || text.indexOf("403") !== -1 || text.indexOf("invalid token") !== -1)
        return fail(provider, "invalid_credentials", "Provider credentials were rejected", false, 401)
    if (text.indexOf("429") !== -1 || text.indexOf("rate limit") !== -1)
        return fail(provider, "rate_limited", "Provider rate limit reached", true, 429)
    return fail(provider, "network_error", "Provider unavailable", true, 0)
}

function parseJson(raw, provider) {
    try { return { ok: true, value: JSON.parse(String(raw || "")) } }
    catch (error) { return { ok: false, error: fail(provider, "malformed_response", "Provider returned invalid JSON", false, 0) } }
}

function normalizeNominatim(raw) {
    var parsed = typeof raw === "string" ? parseJson(raw, "nominatim") : { ok: true, value: raw }
    if (!parsed.ok) return parsed.error
    if (!Array.isArray(parsed.value) || parsed.value.length === 0)
        return fail("nominatim", "not_found", "Destination could not be geocoded", false, 404)
    var first = parsed.value[0] || {}
    var point = coordinates(first)
    if (!point) return fail("nominatim", "malformed_response", "Geocoder returned invalid coordinates", false, 0)
    return ok("nominatim", {
        coordinates: point,
        label: cleanText(first.display_name),
        providerId: cleanText(first.osm_type) + String(first.osm_id || first.place_id || "")
    }, { attribution: "© OpenStreetMap contributors" })
}

function normalizeOsrm(raw) {
    var parsed = typeof raw === "string" ? parseJson(raw, "osrm") : { ok: true, value: raw }
    if (!parsed.ok) return parsed.error
    var data = parsed.value || {}
    if (data.code !== "Ok") return fail("osrm", cleanText(data.code || "route_failed").toLowerCase(), cleanText(data.message || "No route found"), false, 0)
    if (!Array.isArray(data.routes) || !data.routes.length)
        return fail("osrm", "not_found", "No route found", false, 404)
    var route = data.routes[0] || {}
    var durationSeconds = finite(route.duration)
    var distanceMeters = finite(route.distance)
    if (!isFinite(durationSeconds) || durationSeconds < 0)
        return fail("osrm", "malformed_response", "Router returned an invalid duration", false, 0)
    return ok("osrm", {
        travelMinutes: Math.max(0, Math.ceil(durationSeconds / 60)),
        typicalMinutes: null,
        trafficDelayMinutes: 0,
        distanceMeters: isFinite(distanceMeters) ? Math.max(0, Math.round(distanceMeters)) : 0,
        trafficAware: false
    }, { attribution: "Routing data © OpenStreetMap contributors" })
}

function normalizeMapbox(raw) {
    var parsed = typeof raw === "string" ? parseJson(raw, "mapbox") : { ok: true, value: raw }
    if (!parsed.ok) return parsed.error
    var data = parsed.value || {}
    var providerMessage = cleanText(data.message).toLowerCase()
    if (providerMessage.indexOf("token") !== -1 || providerMessage.indexOf("not authorized") !== -1)
        return fail("mapbox", "invalid_credentials", cleanText(data.message || "Traffic credentials were rejected"), false, 401)
    if (providerMessage.indexOf("rate limit") !== -1 || providerMessage.indexOf("too many") !== -1)
        return fail("mapbox", "rate_limited", cleanText(data.message || "Traffic provider rate limit reached"), true, 429)
    if (data.code && data.code !== "Ok") {
        var auth = data.code === "Unauthorized" || data.code === "Forbidden"
        return fail("mapbox", auth ? "invalid_credentials" : cleanText(data.code).toLowerCase(), cleanText(data.message || "Traffic route failed"), !auth, auth ? 401 : 0)
    }
    if (!Array.isArray(data.routes) || !data.routes.length)
        return fail("mapbox", "not_found", "No traffic route found", false, 404)
    var route = data.routes[0] || {}
    var durationSeconds = finite(route.duration)
    var typicalSeconds = finite(route.duration_typical)
    if (!isFinite(typicalSeconds) && Array.isArray(route.legs) && route.legs.length)
        typicalSeconds = finite(route.legs[0].duration_typical)
    if (!isFinite(durationSeconds) || durationSeconds < 0)
        return fail("mapbox", "malformed_response", "Traffic provider returned an invalid duration", false, 0)
    var travel = Math.max(0, Math.ceil(durationSeconds / 60))
    var typical = isFinite(typicalSeconds) && typicalSeconds >= 0 ? Math.max(0, Math.ceil(typicalSeconds / 60)) : travel
    return ok("mapbox", {
        travelMinutes: travel,
        typicalMinutes: typical,
        trafficDelayMinutes: travel - typical,
        distanceMeters: isFinite(finite(route.distance)) ? Math.max(0, Math.round(Number(route.distance))) : 0,
        trafficAware: true
    }, {})
}

function query(value) {
    return encodeURIComponent(String(value || ""))
}

function coordinatePair(point) {
    var normalized = coordinates(point)
    return normalized ? normalized.longitude.toFixed(6) + "," + normalized.latitude.toFixed(6) : ""
}

function nominatimRequest(searchText, countryCodes) {
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=" + query(searchText)
    if (cleanText(countryCodes)) url += "&countrycodes=" + query(String(countryCodes).toLowerCase())
    return { provider: "nominatim", kind: "geocode", url: url, userAgent: USER_AGENT }
}

function osrmRequest(origin, destination, mode) {
    if (String(mode || "drive") !== "drive") return null
    var from = coordinatePair(origin)
    var to = coordinatePair(destination)
    if (!from || !to) return null
    return {
        provider: "osrm",
        kind: "route",
        url: "https://router.project-osrm.org/route/v1/driving/" + from + ";" + to + "?overview=false&steps=false&alternatives=false",
        userAgent: USER_AGENT
    }
}

function mapboxRequest(origin, destination, mode, token) {
    var profile = String(mode || "drive") === "walk" ? "walking"
        : (String(mode || "drive") === "cycle" ? "cycling" : "driving-traffic")
    var from = coordinatePair(origin)
    var to = coordinatePair(destination)
    var key = cleanText(token)
    if (!from || !to || !key) return null
    return {
        provider: "mapbox",
        kind: "route",
        url: "https://api.mapbox.com/directions/v5/mapbox/" + profile + "/" + from + ";" + to
            + "?overview=false&steps=false&alternatives=false&access_token=" + query(key),
        userAgent: USER_AGENT
    }
}

function providerStatus(settings, mapboxToken, currentLocation) {
    var network = settings && settings.networkEnabled === true
    var traffic = network && cleanText(mapboxToken) !== ""
    return {
        networkEnabled: network,
        geocoding: network ? "Nominatim / OpenStreetMap" : "Disabled",
        routing: network ? "OSRM / OpenStreetMap" : "Cached / remembered",
        traffic: traffic ? "Mapbox available" : "Not configured",
        currentLocation: currentLocation ? "Available for this session" : "Unavailable"
    }
}
