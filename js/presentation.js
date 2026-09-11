.pragma library

function finiteDuration(value) {
    if (value === null || value === undefined || value === "") return NaN
    var number = Number(value)
    return isFinite(number) && number >= 0 ? Math.round(number) : NaN
}

function timingMode(departure) {
    return String(departure && departure.timingMode || "auto").toLowerCase() === "manual" ? "manual" : "auto"
}

function effectiveTravelMinutes(departure) {
    if (timingMode(departure) === "manual") return finiteDuration(departure && departure.manualTravelMinutes)
    var automatic = finiteDuration(departure && departure.autoTravelMinutes)
    if (isFinite(automatic)) return automatic
    return finiteDuration(departure && departure.manualTravelMinutes)
}

function hasUsableTiming(departure) {
    return isFinite(effectiveTravelMinutes(departure))
}

function timingSource(departure) {
    if (!hasUsableTiming(departure)) return "Unavailable"
    if (timingMode(departure) === "manual") return "Fixed time"
    var status = String(departure && departure.routeStatus || "").toLowerCase()
    if (status === "fallback") return "Saved"
    if (status === "cached") return "Saved estimate"
    if (status === "live" && departure && departure.routeTrafficAware === true) return "Live estimate"
    return "Automatic"
}

function travelLine(departure) {
    var travel = effectiveTravelMinutes(departure)
    if (!isFinite(travel)) return "Travel time unavailable"
    return "Travel " + travel + " min · " + timingSource(departure)
}

function freshness(checkedAt, now) {
    var checked = Number(checkedAt)
    if (!isFinite(checked) || checked <= 0) return ""
    var elapsed = Math.max(0, Number(now) - checked)
    if (elapsed < 60000) return "just now"
    var minutes = Math.floor(elapsed / 60000)
    if (minutes < 60) return minutes + "m ago"
    var hours = Math.floor(minutes / 60)
    if (hours < 24) return hours + "h ago"
    return Math.floor(hours / 24) + "d ago"
}

function compactTimingLine(mode, travelMinutes, routeStatus, checkedAt, now, trafficAware) {
    var travel = Number(travelMinutes)
    if (!isFinite(travel) || travel < 0) return "ROUTE NEEDED"
    if (String(mode || "auto").toLowerCase() === "manual") return "Fixed · " + Math.round(travel) + "m"
    var status = String(routeStatus || "").toLowerCase()
    if (status === "fallback") return "Automatic · saved " + Math.round(travel) + "m"
    var result = (trafficAware === true ? "Live" : "Automatic") + " · " + Math.round(travel) + "m"
    var age = freshness(checkedAt, now)
    return age ? result + " · " + age : result
}

function impact(departure) {
    if (!hasUsableTiming(departure)) {
        return {
            level: "blocking",
            title: "Departure time cannot be calculated",
            message: "Add a travel time or update the locations before relying on this departure."
        }
    }
    if (timingMode(departure) === "auto" && String(departure && departure.routeStatus || "") === "fallback") {
        return {
            level: "informational",
            title: "Using saved travel time",
            message: "Using saved " + effectiveTravelMinutes(departure) + " min travel time"
        }
    }
    return { level: "normal", title: "", message: "" }
}

function routeErrorCode(departure) {
    var code = String(departure && departure.routeErrorCode || "").toLowerCase()
    if (code === "noroute") return "no_route"
    return code
}

function routingExplanation(departure) {
    if (timingMode(departure) === "manual")
        return "Automatic routing is paused while fixed travel time is selected."
    var code = routeErrorCode(departure)
    if (code === "no_route")
        return "The route provider could not calculate a driving route between the selected locations."
    if (code === "not_found")
        return "One of the selected locations could not be found."
    if (code === "invalid_coordinates")
        return "One of the saved locations needs to be updated."
    if (code === "timeout" || code === "dns_failure" || code === "network_error" || code === "rate_limited")
        return "Automatic routing could not be reached. You can keep using the saved travel time."
    if (code === "invalid_credentials")
        return "Live traffic is unavailable. The saved travel time is still in use."
    if (String(departure && departure.routeStatus || "") === "fallback")
        return "Automatic routing could not refresh this trip. The saved travel time is still in use."
    if (String(departure && departure.routeStatus || "") === "cached")
        return "Using the most recent saved route estimate."
    if (String(departure && departure.routeStatus || "") === "live")
        return "Automatic routing is up to date."
    return "Automatic routing will refresh when both locations are available."
}

function routingTitle(departure) {
    if (!hasUsableTiming(departure)) return "Travel time unavailable"
    if (timingMode(departure) === "manual") return "Fixed travel time"
    if (String(departure && departure.routeStatus || "") === "fallback") return "Automatic routing unavailable"
    if (String(departure && departure.routeStatus || "") === "cached") return "Saved route estimate"
    if (String(departure && departure.routeStatus || "") === "live") return "Automatic routing"
    return "Automatic travel time"
}

function pad(value) {
    return String(value).padStart(2, "0")
}

function arrivalLabel(ms, now) {
    var value = Number(ms)
    if (!isFinite(value)) return "Arrival time unavailable"
    var date = new Date(value)
    var today = new Date(Number(now) || Date.now())
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    var target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    var days = Math.round((target - start) / 86400000)
    var day = days === 0 ? "Today" : (days === 1 ? "Tomorrow"
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] + " " + date.getDate() + " "
            + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()])
    return day + " · " + pad(date.getHours()) + ":" + pad(date.getMinutes())
}
