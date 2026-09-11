.pragma library

function keyFor(departure, kind) {
    return String(departure.id) + ":" + String(departure.revision || 1) + ":" + kind
}

function dueEvents(departure, now, sent, times) {
    var state = sent || {}
    var result = []
    if (!departure || !times || now > times.eventTime) return result
    var leaveKey = keyFor(departure, "leave")
    var readyKey = keyFor(departure, "ready")
    if (now >= times.leaveTime) {
        if (!state[leaveKey]) result.push({ kind: "leave", key: leaveKey })
    } else if (now >= times.getReadyTime && !state[readyKey]) {
        result.push({ kind: "ready", key: readyKey })
    }
    return result
}

function mark(sent, event, now) {
    var result = {}
    var source = sent || {}
    for (var key in source) result[key] = source[key]
    result[event.key] = Number(now)
    return result
}

function prune(sent, departures) {
    var prefixes = {}
    var source = Array.isArray(departures) ? departures : []
    for (var i = 0; i < source.length; i++)
        prefixes[String(source[i].id) + ":" + String(source[i].revision || 1) + ":"] = true
    var result = {}
    for (var key in (sent || {})) {
        for (var prefix in prefixes) {
            if (key.indexOf(prefix) === 0) {
                result[key] = sent[key]
                break
            }
        }
    }
    return result
}
