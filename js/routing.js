.pragma library

var MINUTE_MS = 60000
var HOUR_MS = 3600000
var DAY_MS = 86400000
var STALE_CACHE_MS = 7 * DAY_MS

function finite(value, fallback) {
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function isAutomaticTiming(departure) {
    return String(departure && departure.timingMode || "auto").toLowerCase() !== "manual"
}
function roundCoordinate(value) {
    return Math.round(Number(value) * 100000) / 100000
}

function cacheKey(origin, destination, mode, provider) {
    if (!origin || !destination) return ""
    return [provider || "cached", mode || "drive",
        roundCoordinate(origin.latitude), roundCoordinate(origin.longitude),
        roundCoordinate(destination.latitude), roundCoordinate(destination.longitude)].join(":")
}

function cacheReferences(key, point) {
    if (!key || !point) return false
    var parts = String(key).split(":")
    var latitude = String(roundCoordinate(point.latitude))
    var longitude = String(roundCoordinate(point.longitude))
    return (parts[2] === latitude && parts[3] === longitude)
        || (parts[4] === latitude && parts[5] === longitude)
}

function providerMinimumInterval(provider) {
    return String(provider || "osrm").toLowerCase() === "mapbox" ? MINUTE_MS : 5 * MINUTE_MS
}

function refreshInterval(untilLeaveMs, provider) {
    var remaining = finite(untilLeaveMs, Infinity)
    if (remaining <= 0) return Infinity
    var adaptive = remaining > 12 * HOUR_MS ? 3 * HOUR_MS
        : (remaining >= 6 * HOUR_MS ? HOUR_MS
            : (remaining >= 2 * HOUR_MS ? 30 * MINUTE_MS
                : (remaining >= 30 * MINUTE_MS ? 10 * MINUTE_MS
                    : (remaining >= 10 * MINUTE_MS ? 4 * MINUTE_MS : MINUTE_MS))))
    return Math.max(adaptive, providerMinimumInterval(provider))
}

function nextRefreshAt(departure, now, provider) {
    if (!isAutomaticTiming(departure)) return Infinity
    var leaveTime = Number(departure && departure.leaveTime)
    if (!isFinite(leaveTime)) return Number(now)
    var interval = refreshInterval(leaveTime - Number(now), provider)
    if (!isFinite(interval)) return Infinity
    var checked = Number(departure && departure.routeCheckedAt)
    return isFinite(checked) && checked > 0 ? checked + interval : Number(now)
}

function refreshDue(departure, now, provider) {
    return nextRefreshAt(departure, now, provider) <= Number(now)
}

function backoffInterval(code, retryable) {
    var value = String(code || "")
    if (value === "invalid_credentials") return HOUR_MS
    if (value === "rate_limited") return 15 * MINUTE_MS
    return retryable === true ? 5 * MINUTE_MS : DAY_MS
}

function cacheEntry(result, now, ttlMs) {
    if (!result || !result.ok) return null
    return {
        provider: String(result.provider || "unknown"),
        value: result.value,
        fetchedAt: Number(now),
        expiresAt: Number(now) + Math.max(MINUTE_MS, finite(ttlMs, 15 * MINUTE_MS))
    }
}

function cached(cache, key, now, allowStale) {
    var entry = cache && key ? cache[key] : null
    if (!entry || !entry.value || !isFinite(Number(entry.fetchedAt))) return null
    var stale = Number(now) > Number(entry.expiresAt || 0)
    if (stale && (!allowStale || Number(now) - Number(entry.fetchedAt) > STALE_CACHE_MS)) return null
    var copy = {}
    for (var field in entry) copy[field] = entry[field]
    copy.stale = stale
    return copy
}

function put(cache, key, entry, maxEntries) {
    var result = {}
    var source = cache || {}
    for (var existing in source) result[existing] = source[existing]
    if (key && entry) result[key] = entry
    var keys = Object.keys(result).sort(function(a, b) {
        return Number(result[b].fetchedAt || 0) - Number(result[a].fetchedAt || 0)
    })
    var limit = Math.max(10, Number(maxEntries) || 100)
    for (var i = limit; i < keys.length; i++) delete result[keys[i]]
    return result
}

function adjustmentThreshold(current, increasing) {
    var proportional = Math.ceil(Math.max(0, Number(current) || 0) * 0.10)
    return Math.max(increasing ? 3 : 5, proportional)
}

function considerAdjustment(departure, candidateMinutes) {
    var candidate = Math.max(0, Math.round(finite(candidateMinutes, NaN)))
    if (!isFinite(candidate)) return { accepted: false, reason: "invalid", candidateSamples: 0 }
    var current = isFinite(Number(departure && departure.autoTravelMinutes))
        ? Number(departure.autoTravelMinutes) : Number(departure && departure.routeTravelMinutes)
    if (!isFinite(current)) current = Number(departure && departure.travelMinutes)
    if (!isFinite(current)) current = candidate
    var delta = candidate - current
    if (delta === 0) return { accepted: false, reason: "unchanged", candidateSamples: 0 }
    var threshold = adjustmentThreshold(current, delta > 0)
    if (Math.abs(delta) < threshold) return { accepted: false, reason: "below-threshold", candidateSamples: 0 }
    if (delta > 0) return { accepted: true, reason: "material-increase", candidateSamples: 0 }
    var previous = Number(departure && departure.routeCandidateMinutes)
    var samples = Math.abs(previous - candidate) <= 2 ? Number(departure.routeCandidateSamples || 0) + 1 : 1
    return { accepted: samples >= 2, reason: samples >= 2 ? "confirmed-decrease" : "awaiting-confirmation", candidateSamples: samples }
}

function applyResult(departure, normalized, now) {
    var copy = {}
    for (var key in departure) copy[key] = departure[key]
    if (!isAutomaticTiming(copy))
        return { departure: copy, adjusted: false, ignored: true, decision: { accepted: false, reason: "manual-mode", candidateSamples: 0 } }
    if (!normalized || !normalized.ok) {
        copy.routeStatus = "fallback"
        copy.routeError = normalized && normalized.error ? String(normalized.error.message || "Route unavailable") : "Route unavailable"
        copy.routeErrorCode = normalized && normalized.error ? String(normalized.error.code || "route_failed") : "route_failed"
        copy.routeCheckedAt = Number(now)
        return { departure: copy, adjusted: false }
    }
    var value = normalized.value || {}
    var previousAutomatic = isFinite(Number(copy.autoTravelMinutes)) ? Number(copy.autoTravelMinutes) : Number(copy.travelMinutes || 0)
    var decision = considerAdjustment(copy, value.travelMinutes)
    copy.routeObservedMinutes = Number(value.travelMinutes)
    copy.routeTypicalMinutes = value.typicalMinutes === null ? null : Number(value.typicalMinutes)
    copy.trafficDelayMinutes = Number(value.trafficDelayMinutes || 0)
    copy.routeDistanceMeters = Number(value.distanceMeters || 0)
    copy.routeProvider = String(normalized.provider || "")
    copy.routeTrafficAware = value.trafficAware === true
    copy.routeCheckedAt = Number(now)
    copy.routeStatus = "live"
    copy.routeError = ""
    copy.routeErrorCode = ""
    if (decision.accepted) {
        copy.autoTravelMinutes = Number(value.travelMinutes)
        copy.routeCandidateMinutes = null
        copy.routeCandidateSamples = 0
        var preservedManual = copy.manualTravelMinutes === null || copy.manualTravelMinutes === undefined
            ? NaN : Number(copy.manualTravelMinutes)
        var baseline = isFinite(preservedManual) ? preservedManual : previousAutomatic
        copy.routeAdjustmentMinutes = Number(copy.autoTravelMinutes) - baseline
        copy.routeReason = decision.reason
    } else if (decision.reason === "awaiting-confirmation") {
        copy.routeCandidateMinutes = Number(value.travelMinutes)
        copy.routeCandidateSamples = decision.candidateSamples
    } else {
        copy.routeCandidateMinutes = null
        copy.routeCandidateSamples = 0
    }
    return { departure: copy, adjusted: decision.accepted, decision: decision }
}

function navigationUrl(departure) {
    if (!departure) return ""
    var origin = String(departure.origin || "")
    var destination = String(departure.destination || "")
    if (!destination) return ""
    function parameter(value) { return encodeURIComponent(value) }
    var mode = String(departure.transportMode || "drive")
    var travelMode = mode === "walk" ? "walking" : (mode === "cycle" ? "bicycling" : (mode === "transit" ? "transit" : "driving"))
    var url = "https://www.google.com/maps/dir/?api=1&destination=" + parameter(destination)
    if (origin && origin.toLowerCase() !== "current location") url += "&origin=" + parameter(origin)
    url += "&travelmode=" + travelMode
    return url
}
