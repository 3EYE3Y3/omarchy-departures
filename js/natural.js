.pragma library

function clean(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ")
}
function parseTime(hourText, minuteText, meridiem) {
    var hour = Number(hourText)
    var minute = minuteText === undefined || minuteText === "" ? 0 : Number(minuteText)
    var suffix = String(meridiem || "").toLowerCase()
    if (suffix) {
        if (hour < 1 || hour > 12) return null
        if (suffix === "pm" && hour !== 12) hour += 12
        if (suffix === "am" && hour === 12) hour = 0
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return { hour: hour, minute: minute }
}

function dateAt(base, offsetDays, time) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, time.hour, time.minute, 0, 0).getTime()
}

function weekdayOffset(base, name) {
    var names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    var target = names.indexOf(String(name || "").slice(0, 3).toLowerCase())
    if (target < 0) return null
    var delta = (target - base.getDay() + 7) % 7
    return delta === 0 ? 7 : delta
}

function parse(text, now) {
    var original = clean(text)
    if (!original) return { ok: false, missing: ["description"], errors: ["Describe the departure"] }
    var timeMatch = original.match(/(?:^|\s)(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
    if (!timeMatch) timeMatch = original.match(/(?:^|\s)(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)
    var parsedTime = timeMatch ? parseTime(timeMatch[1], timeMatch[2], timeMatch[3]) : null
    var missing = []
    if (!parsedTime) missing.push("time")

    var base = new Date(Number(now))
    var dateOffset = null
    var dateMatch = original.match(/\b(today|tomorrow)\b/i)
    if (dateMatch) dateOffset = dateMatch[1].toLowerCase() === "tomorrow" ? 1 : 0
    var weekdayMatch = original.match(/\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i)
    if (dateOffset === null && weekdayMatch) dateOffset = weekdayOffset(base, weekdayMatch[1])
    var isoMatch = original.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
    var arrivalTime = NaN
    if (parsedTime && isoMatch) {
        var candidate = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), parsedTime.hour, parsedTime.minute, 0, 0)
        if (candidate.getFullYear() === Number(isoMatch[1]) && candidate.getMonth() === Number(isoMatch[2]) - 1 && candidate.getDate() === Number(isoMatch[3])) arrivalTime = candidate.getTime()
        else missing.push("date")
    } else if (parsedTime && dateOffset !== null) arrivalTime = dateAt(base, dateOffset, parsedTime)
    else if (parsedTime) {
        arrivalTime = dateAt(base, 0, parsedTime)
        if (arrivalTime <= Number(now)) arrivalTime = dateAt(base, 1, parsedTime)
    }

    var destination = ""
    if (timeMatch) {
        var after = original.slice(timeMatch.index + timeMatch[0].length)
        var destinationMatch = after.match(/^\s*(?:at|in|to)\s+(.+)$/i)
        if (destinationMatch) destination = clean(destinationMatch[1])
    }
    if (!destination) {
        var destinationFallback = original.match(/\s(?:at|in|to)\s+([^@]+)$/i)
        if (destinationFallback && (!timeMatch || destinationFallback.index > timeMatch.index)) destination = clean(destinationFallback[1])
    }
    if (!destination) missing.push("destination")

    var titleEnd = original.length
    if (dateMatch) titleEnd = Math.min(titleEnd, dateMatch.index)
    if (weekdayMatch) titleEnd = Math.min(titleEnd, weekdayMatch.index)
    if (isoMatch) titleEnd = Math.min(titleEnd, isoMatch.index)
    if (timeMatch) titleEnd = Math.min(titleEnd, timeMatch.index)
    var title = clean(original.slice(0, titleEnd)).replace(/\s+(on|at)$/i, "")
    if (!title && destination) title = destination.split(",")[0]
    if (!title) missing.push("activity")

    if (missing.length) return { ok: false, missing: missing, errors: ["Missing " + missing.join(", ")] }
    return { ok: true, missing: [], errors: [], value: { title: title, destination: destination, arrivalTime: arrivalTime } }
}
