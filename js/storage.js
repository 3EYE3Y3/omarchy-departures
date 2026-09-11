.pragma library

function emptyState() {
    return {
        schemaVersion: 3,
        departures: [],
        places: [],
        kits: [],
        routeCache: {},
        settings: {},
        sentNotifications: {}
    }
}

function finiteDuration(value) {
    if (value === null || value === undefined || value === "") return NaN
    var number = Number(value)
    return isFinite(number) && number >= 0 ? Math.round(number) : NaN
}

function migrateDeparture(input, schemaVersion) {
    var record = {}
    for (var key in (input || {})) record[key] = input[key]
    if (record.timingMode !== "auto" && record.timingMode !== "manual") record.timingMode = "auto"
    var legacy = finiteDuration(record.travelMinutes)
    var manual = finiteDuration(record.manualTravelMinutes)
    var automatic = finiteDuration(record.autoTravelMinutes)
    var routed = finiteDuration(record.routeTravelMinutes)
    record.manualTravelMinutes = isFinite(manual) ? manual
        : (schemaVersion < 3 && isFinite(legacy) ? legacy : null)
    record.autoTravelMinutes = isFinite(automatic) ? automatic : (isFinite(routed) ? routed : (isFinite(legacy) ? legacy : record.manualTravelMinutes))
    // v0.1/v0.2 treated travelMinutes as required, so keep their historical zero
    // fallback. Schema v3 can represent a genuinely missing timing value; preserve
    // it so the UI can show a recoverable blocking state.
    if (!isFinite(finiteDuration(record.autoTravelMinutes)))
        record.autoTravelMinutes = schemaVersion < 3 ? 0 : null
    delete record.travelMinutes
    delete record.routeTravelMinutes
    return record
}
function decode(raw) {
    var data
    try { data = JSON.parse(String(raw || "{}")) }
    catch (error) { return { ok: false, error: "State file contains invalid JSON", value: emptyState(), migrated: false } }
    if (!data || (data.schemaVersion !== 1 && data.schemaVersion !== 2 && data.schemaVersion !== 3)) {
        if (Object.keys(data || {}).length === 0) return { ok: true, value: emptyState(), migrated: false }
        return { ok: false, error: "Unsupported state schema", value: emptyState(), migrated: false }
    }
    var result = emptyState()
    var sourceDepartures = Array.isArray(data.departures) ? data.departures : []
    result.departures = sourceDepartures.map(function(item) { return migrateDeparture(item, data.schemaVersion) })
    result.sentNotifications = data.sentNotifications && typeof data.sentNotifications === "object" ? data.sentNotifications : {}
    if (data.schemaVersion >= 2) {
        result.places = Array.isArray(data.places) ? data.places : []
        result.kits = Array.isArray(data.kits) ? data.kits : []
        result.routeCache = data.routeCache && typeof data.routeCache === "object" ? data.routeCache : {}
        result.settings = data.settings && typeof data.settings === "object" ? data.settings : {}
    }
    return { ok: true, value: result, migrated: data.schemaVersion !== 3 }
}
