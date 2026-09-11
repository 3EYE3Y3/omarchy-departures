.pragma library

var MAX_DURATION_MINUTES = 2880

function cleanText(value, maxLength) {
    return String(value || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ").slice(0, maxLength)
}

function cleanReminders(values) {
    var result = []
    var seen = {}
    var source = Array.isArray(values) ? values : []
    for (var i = 0; i < source.length && result.length < 12; i++) {
        var item = cleanText(source[i], 50)
        var key = item.toLowerCase()
        if (item && !seen[key]) {
            seen[key] = true
            result.push(item)
        }
    }
    return result
}

function cleanCoordinates(value) {
    if (!value) return null
    var latitude = Number(value.latitude)
    var longitude = Number(value.longitude)
    if (!isFinite(latitude) || !isFinite(longitude) || latitude < -90 || latitude > 90
            || longitude < -180 || longitude > 180) return null
    return { latitude: latitude, longitude: longitude }
}

function duration(value) {
    if (value === null || value === undefined || value === "") return NaN
    var number = Number(value)
    if (!isFinite(number)) return NaN
    return Math.round(number)
}

function timingMode(value) {
    return String(value || "auto").toLowerCase() === "manual" ? "manual" : "auto"
}

function durationFallback(primary, secondary, fallback) {
    var value = duration(primary)
    if (!isFinite(value)) value = duration(secondary)
    return isFinite(value) ? value : fallback
}

function validate(input, now, requireFuture, allowMissingTravel) {
    var errors = []
    var title = cleanText(input && input.title, 80)
    var destination = cleanText(input && input.destination, 120)
    var arrivalTime = Number(input && input.arrivalTime)
    var mode = timingMode(input && input.timingMode)
    var manualTravel = durationFallback(input && input.manualTravelMinutes, input && input.travelMinutes, NaN)
    var autoTravel = durationFallback(input && input.autoTravelMinutes,
        input && input.routeTravelMinutes !== undefined ? input.routeTravelMinutes : input && input.travelMinutes, NaN)
    var fields = [
        [mode === "manual" ? "Manual travel time" : "Automatic travel fallback", mode === "manual" ? manualTravel : autoTravel],
        ["Arrival buffer", duration(input && input.arrivalBufferMinutes)],
        ["Preparation time", duration(input && input.preparationMinutes)],
        ["Parking time", duration(input && input.parkingMinutes || 0)],
        ["Walking time", duration(input && input.walkingMinutes || 0)]
    ]
    if (!title) errors.push("Title is required")
    if (!destination) errors.push("Destination is required")
    if (!isFinite(arrivalTime)) errors.push("Arrival date and time are invalid")
    else if (requireFuture && arrivalTime <= Number(now)) errors.push("Arrival must be in the future")
    for (var i = 0; i < fields.length; i++) {
        if (i === 0 && allowMissingTravel && !isFinite(fields[i][1])) continue
        if (!isFinite(fields[i][1]) || fields[i][1] < 0 || fields[i][1] > MAX_DURATION_MINUTES)
            errors.push(fields[i][0] + " must be between 0 and " + MAX_DURATION_MINUTES + " minutes")
    }
    return { valid: errors.length === 0, errors: errors }
}

function normalized(input) {
    var mode = timingMode(input.timingMode)
    var manualTravel = durationFallback(input.manualTravelMinutes, input.travelMinutes, NaN)
    var autoTravel = durationFallback(input.autoTravelMinutes,
        input.routeTravelMinutes !== undefined ? input.routeTravelMinutes : input.travelMinutes, manualTravel)
    var record = {
        title: cleanText(input.title, 80),
        destination: cleanText(input.destination, 120),
        origin: cleanText(input.origin, 120),
        originPlaceId: cleanText(input.originPlaceId, 80),
        destinationPlaceId: cleanText(input.destinationPlaceId, 80),
        originCoordinates: cleanCoordinates(input.originCoordinates),
        destinationCoordinates: cleanCoordinates(input.destinationCoordinates),
        arrivalTime: Number(input.arrivalTime),
        timingMode: mode,
        manualTravelMinutes: isFinite(manualTravel) ? manualTravel : null,
        autoTravelMinutes: isFinite(autoTravel) ? autoTravel : null,
        arrivalBufferMinutes: duration(input.arrivalBufferMinutes),
        preparationMinutes: duration(input.preparationMinutes),
        parkingMinutes: duration(input.parkingMinutes || 0),
        walkingMinutes: duration(input.walkingMinutes || 0),
        transportMode: cleanText(input.transportMode || "other", 30).toLowerCase(),
        profile: cleanText(input.profile || "custom", 30).toLowerCase(),
        reminders: cleanReminders(input.reminders),
        readyItems: cleanReminders(input.readyItems),
        kitKey: cleanText(input.kitKey || input.profile || input.title, 80).toLowerCase(),
        rememberKit: input.rememberKit !== false,
        notes: cleanText(input.notes, 500)
    }
    var routeFields = ["routeObservedMinutes", "routeTypicalMinutes", "trafficDelayMinutes",
        "routeDistanceMeters", "routeCheckedAt", "routeAdjustmentMinutes", "routeCandidateMinutes", "routeCandidateSamples"]
    for (var i = 0; i < routeFields.length; i++) {
        var value = Number(input[routeFields[i]])
        if (isFinite(value)) record[routeFields[i]] = value
    }
    record.routeProvider = cleanText(input.routeProvider, 40)
    record.routeStatus = cleanText(input.routeStatus, 30)
    record.routeError = cleanText(input.routeError, 180)
    record.routeErrorCode = cleanText(input.routeErrorCode, 40).toLowerCase()
    record.routeReason = cleanText(input.routeReason, 60)
    record.routeTrafficAware = input.routeTrafficAware === true
    return record
}

function create(input, now, id) {
    var check = validate(input, now, true)
    if (!check.valid) return { ok: false, errors: check.errors }
    var record = normalized(input)
    record.id = String(id)
    record.revision = 1
    record.createdAt = Number(now)
    record.modifiedAt = Number(now)
    return { ok: true, value: record, errors: [] }
}

function edit(existing, input, now) {
    if (!existing || !existing.id) return { ok: false, errors: ["Departure no longer exists"] }
    var check = validate(input, now, true)
    if (!check.valid) return { ok: false, errors: check.errors }
    var record = normalized(preserveRoute(existing, input))
    record.id = String(existing.id)
    record.revision = Math.max(1, Number(existing.revision) || 1) + 1
    record.createdAt = Number(existing.createdAt) || Number(now)
    record.modifiedAt = Number(now)
    return { ok: true, value: record, errors: [] }
}

function sameSchedule(existing, input) {
    if (!existing) return false
    var fields = ["origin", "destination", "transportMode"]
    for (var i = 0; i < fields.length; i++) if (String(existing[fields[i]] || "") !== String(input[fields[i]] || "")) return false
    return true
}

function preserveRoute(existing, input) {
    var result = {}
    for (var key in input) result[key] = input[key]
    if (!sameSchedule(existing, input)) return result
    var routeFields = ["originCoordinates", "destinationCoordinates", "routeObservedMinutes", "routeTypicalMinutes",
        "trafficDelayMinutes", "routeDistanceMeters", "routeCheckedAt", "routeAdjustmentMinutes", "routeCandidateMinutes",
        "routeCandidateSamples", "routeProvider", "routeStatus", "routeError", "routeErrorCode", "routeReason", "routeTrafficAware"]
    for (var i = 0; i < routeFields.length; i++) if (result[routeFields[i]] === undefined) result[routeFields[i]] = existing[routeFields[i]]
    return result
}

function restore(input) {
    if (!input || !input.id) return null
    // Keep otherwise valid persisted departures visible when their timing value is
    // absent or damaged. The UI can then explain the blocking state and offer Edit,
    // instead of silently discarding the user's departure during restore.
    var check = validate(input, 0, false, true)
    if (!check.valid) return null
    var record = normalized(input)
    record.id = String(input.id)
    record.revision = Math.max(1, Number(input.revision) || 1)
    record.createdAt = Number(input.createdAt) || Date.now()
    record.modifiedAt = Number(input.modifiedAt) || record.createdAt
    return record
}

function sort(records) {
    return (Array.isArray(records) ? records.slice() : []).sort(function(a, b) {
        var delta = Number(a.arrivalTime) - Number(b.arrivalTime)
        return delta !== 0 ? delta : String(a.id).localeCompare(String(b.id))
    })
}

function upsert(records, record) {
    var result = []
    var replaced = false
    var source = Array.isArray(records) ? records : []
    for (var i = 0; i < source.length; i++) {
        if (String(source[i].id) === String(record.id)) {
            result.push(record)
            replaced = true
        } else result.push(source[i])
    }
    if (!replaced) result.push(record)
    return sort(result)
}

function remove(records, id) {
    return (Array.isArray(records) ? records : []).filter(function(item) { return String(item.id) !== String(id) })
}
