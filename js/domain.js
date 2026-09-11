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

function duration(value) {
    var number = Number(value)
    if (!isFinite(number)) return NaN
    return Math.round(number)
}

function validate(input, now, requireFuture) {
    var errors = []
    var title = cleanText(input && input.title, 80)
    var destination = cleanText(input && input.destination, 120)
    var arrivalTime = Number(input && input.arrivalTime)
    var fields = [
        ["Travel time", duration(input && input.travelMinutes)],
        ["Arrival buffer", duration(input && input.arrivalBufferMinutes)],
        ["Preparation time", duration(input && input.preparationMinutes)]
    ]
    if (!title) errors.push("Title is required")
    if (!destination) errors.push("Destination is required")
    if (!isFinite(arrivalTime)) errors.push("Arrival date and time are invalid")
    else if (requireFuture && arrivalTime <= Number(now)) errors.push("Arrival must be in the future")
    for (var i = 0; i < fields.length; i++) {
        if (!isFinite(fields[i][1]) || fields[i][1] < 0 || fields[i][1] > MAX_DURATION_MINUTES)
            errors.push(fields[i][0] + " must be between 0 and " + MAX_DURATION_MINUTES + " minutes")
    }
    return { valid: errors.length === 0, errors: errors }
}

function normalized(input) {
    return {
        title: cleanText(input.title, 80),
        destination: cleanText(input.destination, 120),
        arrivalTime: Number(input.arrivalTime),
        travelMinutes: duration(input.travelMinutes),
        arrivalBufferMinutes: duration(input.arrivalBufferMinutes),
        preparationMinutes: duration(input.preparationMinutes),
        transportMode: cleanText(input.transportMode || "other", 30).toLowerCase(),
        profile: cleanText(input.profile || "custom", 30).toLowerCase(),
        reminders: cleanReminders(input.reminders),
        notes: cleanText(input.notes, 500)
    }
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
    var record = normalized(input)
    record.id = String(existing.id)
    record.revision = Math.max(1, Number(existing.revision) || 1) + 1
    record.createdAt = Number(existing.createdAt) || Number(now)
    record.modifiedAt = Number(now)
    return { ok: true, value: record, errors: [] }
}

function restore(input) {
    if (!input || !input.id) return null
    var check = validate(input, 0, false)
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
