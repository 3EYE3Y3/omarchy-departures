.pragma library

function pad(value) {
    return String(value).padStart(2, "0")
}

function localDateKey(ms) {
    var date = new Date(Number(ms))
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

function localTime(ms) {
    if (!isFinite(Number(ms))) return "—"
    var date = new Date(Number(ms))
    return pad(date.getHours()) + ":" + pad(date.getMinutes())
}

function dayHeading(ms, now) {
    var date = new Date(Number(ms))
    var today = new Date(Number(now))
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    var days = Math.round((target - start) / 86400000)
    var prefix = days === 0 ? "TODAY · " : (days === 1 ? "TOMORROW · " : "")
    var weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()]
    var month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][date.getMonth()]
    return prefix + weekday + " " + pad(date.getDate()) + " " + month
}

function rows(departures, now) {
    var source = Array.isArray(departures) ? departures.slice() : []
    source.sort(function(a, b) {
        var delta = Number(a.arrivalTime) - Number(b.arrivalTime)
        return delta !== 0 ? delta : String(a.id || "").localeCompare(String(b.id || ""))
    })
    var result = []
    var previousDay = ""
    for (var i = 0; i < source.length; i++) {
        var departure = source[i] || {}
        var day = localDateKey(departure.arrivalTime)
        var reliable = departure.timingReliable !== false && isFinite(Number(departure.leaveTime))
        result.push({
            departureId: String(departure.id || ""),
            arrivalTime: Number(departure.arrivalTime),
            arriveText: localTime(departure.arrivalTime),
            destination: String(departure.destination || departure.title || "Departure"),
            leaveTime: reliable ? Number(departure.leaveTime) : 0,
            leaveText: reliable ? localTime(departure.leaveTime) : "—",
            statusText: reliable ? String(departure.status || "ON TIME") : "ROUTE NEEDED",
            timingMode: String(departure.timingMode || "auto"),
            effectiveTravelMinutes: reliable ? Number(departure.effectiveTravelMinutes) : -1,
            timingReliable: reliable,
            routeStatus: String(departure.routeStatus || ""),
            routeCheckedAt: Number(departure.routeCheckedAt || 0),
            routeTrafficAware: departure.routeTrafficAware === true,
            dayKey: day,
            dayHeading: dayHeading(departure.arrivalTime, now),
            showDayHeading: day !== previousDay
        })
        previousDay = day
    }
    return result
}

function sameValue(left, right) {
    if (typeof left === "number" && typeof right === "number" && isNaN(left) && isNaN(right)) return true
    return left === right
}

function findRow(model, id, start) {
    for (var i = Math.max(0, Number(start) || 0); i < model.count; i++)
        if (String(model.get(i).departureId) === String(id)) return i
    return -1
}

// Reconcile by stable departure ID. It deliberately never clears the model:
// unchanged delegates retain identity, focus, hover state, and ListView position.
function syncModel(model, desired) {
    var rowsValue = Array.isArray(desired) ? desired : []
    var wanted = {}
    var stats = { inserted: 0, removed: 0, moved: 0, updatedRows: 0, updatedProperties: 0 }
    for (var i = 0; i < rowsValue.length; i++) wanted[String(rowsValue[i].departureId)] = true
    for (var removeIndex = model.count - 1; removeIndex >= 0; removeIndex--) {
        if (!wanted[String(model.get(removeIndex).departureId)]) {
            model.remove(removeIndex)
            stats.removed += 1
        }
    }
    for (var target = 0; target < rowsValue.length; target++) {
        var desiredRow = rowsValue[target]
        var existing = findRow(model, desiredRow.departureId, target)
        if (existing < 0) {
            model.insert(target, desiredRow)
            stats.inserted += 1
            continue
        }
        if (existing !== target) {
            model.move(existing, target, 1)
            stats.moved += 1
        }
        var current = model.get(target)
        var changed = false
        for (var role in desiredRow) {
            if (!sameValue(current[role], desiredRow[role])) {
                model.setProperty(target, role, desiredRow[role])
                stats.updatedProperties += 1
                changed = true
            }
        }
        if (changed) stats.updatedRows += 1
    }
    return stats
}
