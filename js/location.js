.pragma library

function coordinates(value) {
    if (!value) return null
    var latitude = Number(value.latitude !== undefined ? value.latitude : value.lat)
    var longitude = Number(value.longitude !== undefined ? value.longitude : value.lon)
    if (!isFinite(latitude) || !isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
    return { latitude: latitude, longitude: longitude }
}
function parseCoordinateText(value) {
    var match = String(value || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
    return match ? coordinates({ latitude: Number(match[1]), longitude: Number(match[2]) }) : null
}

function ephemeral(value, label, now) {
    var point = typeof value === "string" ? parseCoordinateText(value) : coordinates(value)
    if (!point) return { ok: false, error: "Coordinates must be LATITUDE,LONGITUDE" }
    return { ok: true, value: { coordinates: point, label: String(label || "Current location"), capturedAt: Number(now) || Date.now() } }
}
