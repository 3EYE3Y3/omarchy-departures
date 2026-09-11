.pragma library

var MINUTE_MS = 60000
var DAY_MS = 86400000

function finiteNumber(value, fallback) {
    var number = Number(value)
    return isFinite(number) ? number : fallback
}

function minutes(value) {
    return Math.max(0, Math.round(finiteNumber(value, 0))) * MINUTE_MS
}

function derive(departure) {
    var eventTime = finiteNumber(departure && departure.arrivalTime, NaN)
    var targetArrivalTime = eventTime - minutes(departure && departure.arrivalBufferMinutes)
    var leaveTime = targetArrivalTime - minutes(departure && departure.travelMinutes)
    var getReadyTime = leaveTime - minutes(departure && departure.preparationMinutes)
    return {
        eventTime: eventTime,
        targetArrivalTime: targetArrivalTime,
        leaveTime: leaveTime,
        getReadyTime: getReadyTime
    }
}

function localDateTime(dateText, timeText) {
    var dateMatch = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
    var timeMatch = String(timeText || "").match(/^(\d{2}):(\d{2})$/)
    if (!dateMatch || !timeMatch) return NaN
    var year = Number(dateMatch[1])
    var month = Number(dateMatch[2]) - 1
    var day = Number(dateMatch[3])
    var hour = Number(timeMatch[1])
    var minute = Number(timeMatch[2])
    if (hour > 23 || minute > 59) return NaN
    var value = new Date(year, month, day, hour, minute, 0, 0)
    if (value.getFullYear() !== year || value.getMonth() !== month || value.getDate() !== day
            || value.getHours() !== hour || value.getMinutes() !== minute) return NaN
    return value.getTime()
}

function pad(value) {
    return String(value).padStart(2, "0")
}

function localDate(ms) {
    var date = new Date(ms)
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
}

function localTime(ms) {
    var date = new Date(ms)
    return pad(date.getHours()) + ":" + pad(date.getMinutes())
}

function dayLabel(ms, now) {
    var date = new Date(ms)
    var today = new Date(now)
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    var days = Math.round((target - start) / DAY_MS)
    if (days === 0) return "TODAY"
    if (days === 1) return "TOMORROW"
    return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()] + " " + pad(date.getDate()) + " "
        + ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][date.getMonth()]
}

function status(departure, now) {
    var times = derive(departure)
    if (now > times.eventTime) return "EXPIRED"
    if (now >= times.targetArrivalTime) return "DEPARTED"
    if (now >= times.leaveTime) return "LEAVE NOW"
    if (times.leaveTime - now <= 10 * MINUTE_MS) return "LEAVE SOON"
    if (now >= times.getReadyTime) return "GET READY"
    return "ON TIME"
}

function isExpired(departure, now) {
    return status(departure, now) === "EXPIRED"
}

function sortDepartures(departures) {
    return (Array.isArray(departures) ? departures.slice() : []).sort(function(a, b) {
        var delta = Number(a.arrivalTime) - Number(b.arrivalTime)
        return delta !== 0 ? delta : String(a.id || "").localeCompare(String(b.id || ""))
    })
}

function upcomingDepartures(departures, now) {
    return sortDepartures(departures).filter(function(departure) {
        return !isExpired(departure, now)
    })
}

function nextDeparture(departures, now) {
    var upcoming = upcomingDepartures(departures, now)
    return upcoming.length ? upcoming[0] : null
}

function countdown(ms) {
    if (ms <= 0) return "NOW"
    var totalMinutes = Math.ceil(ms / MINUTE_MS)
    if (totalMinutes < 60) return totalMinutes + " MIN"
    var hours = Math.floor(totalMinutes / 60)
    var remaining = totalMinutes % 60
    if (hours < 24) return remaining ? hours + "H " + remaining + "M" : hours + "H"
    var days = Math.floor(hours / 24)
    var leftoverHours = hours % 24
    return leftoverHours ? days + "D " + leftoverHours + "H" : days + "D"
}

function compactCountdown(ms) {
    if (ms <= 0) return "NOW"
    var totalMinutes = Math.ceil(ms / MINUTE_MS)
    if (totalMinutes < 60) return totalMinutes + "m"
    var hours = Math.floor(totalMinutes / 60)
    var remaining = totalMinutes % 60
    if (hours < 24) return remaining ? hours + "h " + remaining + "m" : hours + "h"
    return Math.floor(hours / 24) + "d"
}

function nextAction(departure, now) {
    if (!departure) return "NO UPCOMING DEPARTURES"
    var times = derive(departure)
    var title = String(departure.title || "DEPARTURE").toUpperCase()
    if (now >= times.leaveTime) return "LEAVE NOW FOR " + title
    if (now >= times.getReadyTime) return "LEAVE FOR " + title + " IN " + countdown(times.leaveTime - now)
    if (times.getReadyTime - now <= DAY_MS) return "GET READY IN " + countdown(times.getReadyTime - now)
    return "NEXT DEPARTURE " + dayLabel(times.eventTime, now) + " " + localTime(times.eventTime)
}

function barText(departure, now) {
    if (!departure) return "󰁕  No departures"
    var times = derive(departure)
    if (now >= times.leaveTime) return "⚠  LEAVE NOW"
    var remaining = times.leaveTime - now
    var title = String(departure.title || "Departure")
    if (title.length > 22) title = title.slice(0, 21) + "…"
    if (remaining <= 10 * MINUTE_MS) return "󰁕  " + title + " · " + compactCountdown(remaining)
    return "󰁕  " + title + " · Leave " + compactCountdown(remaining)
}

function enrich(departure, now) {
    var copy = {}
    for (var key in departure) copy[key] = departure[key]
    var times = derive(departure)
    for (var timeKey in times) copy[timeKey] = times[timeKey]
    copy.status = status(departure, now)
    return copy
}

function snapshot(departures, now) {
    var upcoming = upcomingDepartures(departures, now).map(function(item) { return enrich(item, now) })
    var next = upcoming.length ? upcoming[0] : null
    return {
        now: now,
        upcoming: upcoming,
        next: next,
        nextAction: nextAction(next, now),
        barText: barText(next, now)
    }
}
