.pragma library

function emptyState() {
    return {
        schemaVersion: 2,
        departures: [],
        places: [],
        kits: [],
        routeCache: {},
        settings: {},
        sentNotifications: {}
    }
}
function decode(raw) {
    var data
    try { data = JSON.parse(String(raw || "{}")) }
    catch (error) { return { ok: false, error: "State file contains invalid JSON", value: emptyState(), migrated: false } }
    if (!data || (data.schemaVersion !== 1 && data.schemaVersion !== 2)) {
        if (Object.keys(data || {}).length === 0) return { ok: true, value: emptyState(), migrated: false }
        return { ok: false, error: "Unsupported state schema", value: emptyState(), migrated: false }
    }
    var result = emptyState()
    result.departures = Array.isArray(data.departures) ? data.departures : []
    result.sentNotifications = data.sentNotifications && typeof data.sentNotifications === "object" ? data.sentNotifications : {}
    if (data.schemaVersion === 2) {
        result.places = Array.isArray(data.places) ? data.places : []
        result.kits = Array.isArray(data.kits) ? data.kits : []
        result.routeCache = data.routeCache && typeof data.routeCache === "object" ? data.routeCache : {}
        result.settings = data.settings && typeof data.settings === "object" ? data.settings : {}
    }
    return { ok: true, value: result, migrated: data.schemaVersion === 1 }
}
