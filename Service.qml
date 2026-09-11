pragma ComponentBehavior: Bound
import QtQuick
import Quickshell
import Quickshell.Io
import "js/timing.js" as Timing
import "js/domain.js" as Domain
import "js/notification_state.js" as NotificationState
import "js/providers.js" as Providers
import "js/routing.js" as Routing
import "js/places.js" as Places
import "js/kits.js" as Kits
import "js/natural.js" as Natural
import "js/location.js" as Location
import "js/storage.js" as Storage

Item {
    id: service

    property var shell: null
    property var manifest: null
    readonly property string stateHome: {
        var configured = Quickshell.env("XDG_STATE_HOME")
        return configured && configured !== "" ? configured : Quickshell.env("HOME") + "/.local/state"
    }
    readonly property string statePath: stateHome + "/omarchy/departures/state.json"
    readonly property string mapboxToken: Quickshell.env("MAPBOX_ACCESS_TOKEN") || Quickshell.env("DEPARTURES_MAPBOX_TOKEN") || ""
    property var departures: []
    property var places: []
    property var kits: []
    property var routeCache: ({})
    property var settings: settingsDefaults()
    property var sentNotifications: ({})
    property var currentLocation: initialLocation()
    property var snapshot: Timing.snapshot([], Date.now())
    property bool hydrated: false
    property string lastError: ""
    property string providerMessage: ""
    property var notificationQueue: []
    property bool writeDirty: false
    property string writePayload: ""
    property int serial: 0
    property var networkQueue: []
    property var activeNetworkJob: null
    property double lastNominatimAt: 0
    property var networkBackoff: ({})

    readonly property string barText: snapshot ? snapshot.barText : "󰁕  No departures"
    readonly property var nextDeparture: snapshot ? snapshot.next : null
    readonly property var upcoming: snapshot ? snapshot.upcoming : []
    readonly property string nextAction: snapshot ? snapshot.nextAction : "NO UPCOMING DEPARTURES"
    readonly property var capabilities: Providers.providerStatus(settings, mapboxToken, currentLocation)
    readonly property string capabilityLine: capabilities.routing + "  ·  Traffic: "
        + (mapboxToken ? "available" : "not configured")

    function settingsDefaults() {
        return {
            networkEnabled: false,
            defaultOriginPlaceId: "",
            defaultTravelMinutes: 20,
            defaultArrivalBufferMinutes: 5,
            defaultPreparationMinutes: 15,
            countryCodes: ""
        }
    }

    function normalizedSettings(input) {
        var defaults = settingsDefaults()
        var source = input || {}
        return {
            networkEnabled: source.networkEnabled === true,
            defaultOriginPlaceId: String(source.defaultOriginPlaceId || "").slice(0, 80),
            defaultTravelMinutes: boundedDuration(source.defaultTravelMinutes, defaults.defaultTravelMinutes),
            defaultArrivalBufferMinutes: boundedDuration(source.defaultArrivalBufferMinutes, defaults.defaultArrivalBufferMinutes),
            defaultPreparationMinutes: boundedDuration(source.defaultPreparationMinutes, defaults.defaultPreparationMinutes),
            countryCodes: String(source.countryCodes || "").replace(/[^A-Za-z,]/g, "").toLowerCase().slice(0, 40)
        }
    }

    function boundedDuration(value, fallback) {
        var number = Number(value)
        if (!isFinite(number)) number = fallback
        return Math.max(0, Math.min(2880, Math.round(number)))
    }

    function initialLocation() {
        var configured = Quickshell.env("DEPARTURES_CURRENT_LOCATION")
        var result = Location.ephemeral(configured, "Current location", Date.now())
        return result.ok ? result.value : null
    }

    function newId(now) {
        serial += 1
        return "dep-" + Math.round(now).toString(36) + "-" + serial.toString(36) + "-" + Math.floor(Math.random() * 1679616).toString(36)
    }

    function recordById(id) {
        for (var i = 0; i < departures.length; i++)
            if (String(departures[i].id) === String(id)) return departures[i]
        return null
    }

    function placeFor(value) {
        return Places.find(places, value)
    }

    function defaultOriginPlace() {
        return Places.find(places, settings.defaultOriginPlaceId)
    }

    function defaultsFor(title, destination) {
        var place = Places.find(places, destination)
        var placeDefaults = Places.defaults(place) || {}
        var kit = Kits.suggested(kits, title, placeDefaults.kitKey || "custom")
        var originPlace = Places.find(places, placeDefaults.originPlaceId) || defaultOriginPlace()
        var useCurrent = !originPlace && settings.defaultOriginPlaceId === "__current__" && currentLocation
        return {
            origin: originPlace ? originPlace.name : (useCurrent ? "Current location" : ""),
            originPlaceId: originPlace ? originPlace.id : (useCurrent ? "__current__" : ""),
            destinationPlaceId: place ? place.id : "",
            travelMinutes: place && place.samples ? placeDefaults.travelMinutes : settings.defaultTravelMinutes,
            arrivalBufferMinutes: place && place.samples ? placeDefaults.arrivalBufferMinutes : settings.defaultArrivalBufferMinutes,
            preparationMinutes: place && place.samples ? placeDefaults.preparationMinutes : settings.defaultPreparationMinutes,
            parkingMinutes: placeDefaults.parkingMinutes || 0,
            walkingMinutes: placeDefaults.walkingMinutes || 0,
            kitKey: kit.key,
            reminders: kit.items,
            rememberedPlace: !!place,
            learnedKit: kit.learned
        }
    }

    function attachKnownPlaces(input) {
        var result = {}
        for (var key in input) result[key] = input[key]
        var destinationPlace = Places.find(places, result.destinationPlaceId || result.destination)
        var originPlace = Places.find(places, result.originPlaceId || result.origin)
        if (destinationPlace) {
            result.destinationPlaceId = destinationPlace.id
            if (!result.destinationCoordinates) result.destinationCoordinates = destinationPlace.coordinates
        }
        if (originPlace) {
            result.originPlaceId = originPlace.id
            if (!result.originCoordinates) result.originCoordinates = originPlace.coordinates
        }
        return result
    }

    function learnFrom(record, now) {
        places = Places.learn(places, record, now)
        var destinationPlace = Places.find(places, record.destination)
        if (destinationPlace) record.destinationPlaceId = destinationPlace.id
        if (record.rememberKit !== false && Array.isArray(record.reminders) && record.reminders.length)
            kits = Kits.learn(kits, record.kitKey || record.profile || record.title, record.reminders, now)
    }

    function saveDeparture(input, editingId) {
        var now = Date.now()
        var existing = editingId ? recordById(editingId) : null
        var enrichedInput = attachKnownPlaces(input || {})
        var result = existing ? Domain.edit(existing, enrichedInput, now) : Domain.create(enrichedInput, now, newId(now))
        if (!result.ok) return result
        learnFrom(result.value, now)
        departures = Domain.upsert(departures, result.value)
        sentNotifications = NotificationState.prune(sentNotifications, departures)
        refresh(now)
        requestSave()
        Qt.callLater(function() { service.prepareNetworkFor(result.value.id, true) })
        return result
    }

    function saveNatural(text) {
        var now = Date.now()
        var parsed = Natural.parse(text, now)
        if (!parsed.ok) return parsed
        var basic = parsed.value
        var defaults = defaultsFor(basic.title, basic.destination)
        var input = {
            title: basic.title,
            destination: basic.destination,
            origin: defaults.origin,
            originPlaceId: defaults.originPlaceId,
            destinationPlaceId: defaults.destinationPlaceId,
            arrivalTime: basic.arrivalTime,
            travelMinutes: defaults.travelMinutes,
            arrivalBufferMinutes: defaults.arrivalBufferMinutes,
            preparationMinutes: defaults.preparationMinutes,
            parkingMinutes: defaults.parkingMinutes,
            walkingMinutes: defaults.walkingMinutes,
            transportMode: "drive",
            profile: defaults.kitKey || "custom",
            kitKey: defaults.kitKey,
            reminders: defaults.reminders,
            readyItems: [],
            rememberKit: true,
            notes: ""
        }
        var saved = saveDeparture(input, "")
        if (saved.ok) saved.inferred = {
            rememberedPlace: defaults.rememberedPlace,
            learnedKit: defaults.learnedKit,
            travelMinutes: defaults.travelMinutes
        }
        return saved
    }

    function deleteDeparture(id) {
        if (!recordById(id)) return false
        departures = Domain.remove(departures, id)
        sentNotifications = NotificationState.prune(sentNotifications, departures)
        refresh(Date.now())
        requestSave()
        return true
    }

    function toggleReadyItem(id, item) {
        var departure = recordById(id)
        if (!departure) return false
        var copy = {}
        for (var key in departure) copy[key] = departure[key]
        var ready = Array.isArray(copy.readyItems) ? copy.readyItems.slice() : []
        var target = String(item || "")
        var index = -1
        for (var i = 0; i < ready.length; i++) if (ready[i].toLowerCase() === target.toLowerCase()) index = i
        if (index >= 0) ready.splice(index, 1)
        else ready.push(target)
        copy.readyItems = ready
        copy.modifiedAt = Date.now()
        departures = Domain.upsert(departures, copy)
        refresh(Date.now())
        requestSave()
        return true
    }

    function setPlace(payload) {
        var existing = payload ? Places.find(places, payload.id || payload.name) : null
        if (existing) {
            var merged = {}
            for (var key in existing) merged[key] = existing[key]
            for (var field in payload) merged[field] = payload[field]
            payload = merged
        }
        var before = places.length
        places = Places.upsert(places, payload)
        if (places.length === before && !Places.find(places, payload && (payload.id || payload.name)))
            return { ok: false, errors: ["Place needs a name and address"] }
        requestSave()
        return { ok: true, value: Places.find(places, payload.id || payload.name) }
    }

    function removePlace(value) {
        var existing = Places.find(places, value)
        if (!existing) return false
        places = Places.remove(places, value)
        if (settings.defaultOriginPlaceId === existing.id) {
            var copy = normalizedSettings(settings)
            copy.defaultOriginPlaceId = ""
            settings = copy
        }
        requestSave()
        return true
    }

    function setKit(payload) {
        if (!payload || !payload.key || !Array.isArray(payload.items) || !payload.items.length)
            return { ok: false, errors: ["Kit needs a key and at least one item"] }
        kits = Kits.learn(kits, payload.key, payload.items, Date.now())
        requestSave()
        return { ok: true, value: Kits.suggested(kits, payload.key, payload.key) }
    }

    function removeKit(value) {
        var before = kits.length
        kits = Kits.remove(kits, value)
        if (before === kits.length) return false
        requestSave()
        return true
    }

    function updateSettings(payload) {
        var merged = {}
        for (var key in settings) merged[key] = settings[key]
        for (var field in (payload || {})) merged[field] = payload[field]
        if (payload && payload.defaultOrigin) {
            if (String(payload.defaultOrigin).toLowerCase() === "current location" && currentLocation)
                merged.defaultOriginPlaceId = "__current__"
            else {
                var originPlace = Places.find(places, payload.defaultOrigin)
                if (!originPlace) return { ok: false, errors: ["Default origin must be a saved place or an available Current location"] }
                merged.defaultOriginPlaceId = originPlace.id
            }
        }
        settings = normalizedSettings(merged)
        requestSave()
        if (settings.networkEnabled) Qt.callLater(function() { service.prepareAllNetwork() })
        return { ok: true, value: settings, capabilities: capabilities }
    }

    function resetLearning() {
        places = []
        kits = []
        routeCache = ({})
        var next = normalizedSettings(settings)
        next.defaultOriginPlaceId = ""
        settings = next
        requestSave()
        return true
    }

    function setCurrentLocation(value, label) {
        var result = Location.ephemeral(value, label, Date.now())
        if (!result.ok) return result
        currentLocation = result.value
        Qt.callLater(function() { service.prepareAllNetwork() })
        return result
    }

    function openNavigation(departure) {
        var url = Routing.navigationUrl(departure)
        if (!url) return false
        Qt.openUrlExternally(url)
        return true
    }

    function refresh(now) {
        var timestamp = Number(now)
        if (!isFinite(timestamp)) timestamp = Date.now()
        snapshot = Timing.snapshot(departures, timestamp)
        if (hydrated) {
            evaluateNotifications(timestamp)
            maybeRefreshRoutes(timestamp)
        }
    }

    function evaluateNotifications(now) {
        var changed = false
        for (var i = 0; i < departures.length; i++) {
            var departure = departures[i]
            var times = Timing.derive(departure)
            var events = NotificationState.dueEvents(departure, now, sentNotifications, times)
            for (var e = 0; e < events.length; e++) {
                sentNotifications = NotificationState.mark(sentNotifications, events[e], now)
                var queue = notificationQueue.slice()
                queue.push({ departure: departure, kind: events[e].kind, leaveTime: times.leaveTime })
                notificationQueue = queue
                changed = true
            }
        }
        if (changed) requestSave()
        else drainNotifications()
    }

    function notificationCommand(item) {
        var title = String(item.departure.title || "Departure")
        if (item.kind === "leave") {
            return ["omarchy-notification-send", "--app-name", "departures", "-g", "󰁕", "-u", "critical",
                "Departures", "Leave now for " + title]
        }
        var minutesLeft = Math.max(0, Math.ceil((Number(item.leaveTime) - Date.now()) / Timing.MINUTE_MS))
        return ["omarchy-notification-send", "--app-name", "departures", "-g", "󰁕", "-u", "normal",
            "Departures", "Get ready for " + title + "\nLeave in " + minutesLeft + " minutes"]
    }

    function drainNotifications() {
        if (stateWriter.running || notificationProcess.running || notificationQueue.length === 0) return
        var queue = notificationQueue.slice()
        var item = queue.shift()
        notificationQueue = queue
        notificationProcess.command = notificationCommand(item)
        notificationProcess.running = true
    }

    function resolvedCoordinates(departure, role) {
        if (!departure) return null
        if (role === "origin") {
            if (departure.originCoordinates) return departure.originCoordinates
            if (String(departure.origin || "").toLowerCase() === "current location" && currentLocation) return currentLocation.coordinates
            var originPlace = Places.find(places, departure.originPlaceId || departure.origin) || (!departure.origin ? defaultOriginPlace() : null)
            return originPlace ? originPlace.coordinates : null
        }
        if (departure.destinationCoordinates) return departure.destinationCoordinates
        var destinationPlace = Places.find(places, departure.destinationPlaceId || departure.destination)
        return destinationPlace ? destinationPlace.coordinates : null
    }

    function enqueueNetwork(job) {
        if (!settings.networkEnabled || !job || !job.key) return false
        if (Number(networkBackoff[job.key] || 0) > Date.now()) return false
        if (activeNetworkJob && activeNetworkJob.key === job.key) return false
        for (var i = 0; i < networkQueue.length; i++) if (networkQueue[i].key === job.key) return false
        var queue = networkQueue.slice()
        queue.push(job)
        networkQueue = queue
        startNextNetwork()
        return true
    }

    function prepareNetworkFor(id, immediate) {
        var departure = recordById(id)
        if (!departure || !settings.networkEnabled) return
        var origin = resolvedCoordinates(departure, "origin")
        var destination = resolvedCoordinates(departure, "destination")
        if (!destination && departure.destination)
            enqueueNetwork({ key: "geocode:destination:" + departure.id + ":" + departure.destination,
                kind: "geocode", role: "destination", departureId: departure.id, query: departure.destination })
        if (!origin && departure.origin && String(departure.origin).toLowerCase() !== "current location")
            enqueueNetwork({ key: "geocode:origin:" + departure.id + ":" + departure.origin,
                kind: "geocode", role: "origin", departureId: departure.id, query: departure.origin })
        if (origin && destination) queueRoute(departure, origin, destination, immediate === true)
    }

    function prepareAllNetwork() {
        var source = upcoming.slice(0, 3)
        for (var i = 0; i < source.length; i++) prepareNetworkFor(source[i].id, true)
    }

    function maybeRefreshRoutes(now) {
        if (!settings.networkEnabled || networkProcess.running) return
        var source = upcoming.slice(0, 3)
        for (var i = 0; i < source.length; i++) {
            var departure = recordById(source[i].id)
            if (!departure) continue
            var times = Timing.derive(departure)
            var interval = Routing.refreshInterval(times.leaveTime - now)
            if (!isFinite(interval)) continue
            if (!Number(departure.routeCheckedAt) || now - Number(departure.routeCheckedAt) >= interval)
                prepareNetworkFor(departure.id, false)
        }
    }

    function queueRoute(departure, origin, destination, immediate) {
        var provider = mapboxToken ? "mapbox" : "osrm"
        var request = provider === "mapbox" ? Providers.mapboxRequest(origin, destination, departure.transportMode, mapboxToken)
            : Providers.osrmRequest(origin, destination, departure.transportMode)
        if (!request) {
            if (departure.transportMode !== "drive" && !mapboxToken) providerMessage = "Walking/cycling routing needs optional Mapbox; using remembered time"
            return
        }
        var key = Routing.cacheKey(origin, destination, departure.transportMode, provider)
        var cached = Routing.cached(routeCache, key, Date.now(), false)
        if (cached && (!departure.routeCheckedAt || immediate)) {
            applyRouteResult(departure.id, { ok: true, provider: cached.provider, value: cached.value }, Date.now(), true)
            if (Number(cached.expiresAt) > Date.now()) return
        }
        enqueueNetwork({ key: "route:" + departure.id + ":" + key, kind: "route", departureId: departure.id,
            provider: provider, request: request, cacheKey: key })
    }

    function startNextNetwork() {
        if (networkProcess.running || networkQueue.length === 0 || !settings.networkEnabled) return
        var queue = networkQueue.slice()
        var job = queue.shift()
        networkQueue = queue
        if (job.kind === "geocode") {
            var wait = Math.max(0, 1100 - (Date.now() - lastNominatimAt))
            if (wait > 0) {
                queue.unshift(job)
                networkQueue = queue
                networkDelay.interval = Math.ceil(wait)
                networkDelay.restart()
                return
            }
            job.request = Providers.nominatimRequest(job.query, settings.countryCodes)
            lastNominatimAt = Date.now()
        }
        activeNetworkJob = job
        networkProcess.command = ["curl", "--silent", "--show-error", "--fail-with-body", "--max-time", "8",
            "--connect-timeout", "3", "--user-agent", job.request.userAgent, job.request.url]
        networkProcess.running = true
    }

    function networkFailure(job, code, errorText) {
        return Providers.networkFailure(job.provider || "network", code, errorText)
    }

    function finishNetwork(code, output, errorText) {
        var job = activeNetworkJob
        activeNetworkJob = null
        if (!job) { startNextNetwork(); return }
        var result
        if (job.kind === "geocode") result = Providers.normalizeNominatim(output)
        else if (job.provider === "mapbox") result = Providers.normalizeMapbox(output)
        else result = Providers.normalizeOsrm(output)
        if (Number(code) !== 0 && result.ok) result = networkFailure(job, code, errorText)
        if (Number(code) !== 0 && (!output || result.error.code === "malformed_response")) result = networkFailure(job, code, errorText)
        var backoff = {}
        for (var key in networkBackoff) backoff[key] = networkBackoff[key]
        if (result.ok) delete backoff[job.key]
        else {
            var delay = result.error.code === "invalid_credentials" ? 3600000
                : (result.error.code === "rate_limited" ? 900000 : (result.error.retryable ? 300000 : 86400000))
            backoff[job.key] = Date.now() + delay
        }
        networkBackoff = backoff
        if (job.kind === "geocode") finishGeocode(job, result)
        else finishRoute(job, result)
        startNextNetwork()
    }

    function finishGeocode(job, result) {
        var departure = recordById(job.departureId)
        if (!departure) return
        if (!result.ok) {
            providerMessage = result.error.message + "; using remembered/manual timing"
            return
        }
        var copy = {}
        for (var key in departure) copy[key] = departure[key]
        if (job.role === "origin" && String(copy.origin) === String(job.query)) {
            copy.originCoordinates = result.value.coordinates
            places = Places.withGeocode(places, copy.origin, result.value, Date.now())
            var originPlace = Places.find(places, copy.origin)
            if (originPlace) copy.originPlaceId = originPlace.id
        } else if (job.role === "destination" && String(copy.destination) === String(job.query)) {
            copy.destinationCoordinates = result.value.coordinates
            places = Places.withGeocode(places, copy.destination, result.value, Date.now())
            var destinationPlace = Places.find(places, copy.destination)
            if (destinationPlace) copy.destinationPlaceId = destinationPlace.id
        } else return
        departures = Domain.upsert(departures, copy)
        providerMessage = ""
        requestSave()
        prepareNetworkFor(copy.id, true)
    }

    function finishRoute(job, result) {
        var departure = recordById(job.departureId)
        if (!departure) return
        var now = Date.now()
        if (result.ok) {
            var untilLeave = Timing.derive(departure).leaveTime - now
            var ttl = Routing.refreshInterval(untilLeave)
            if (!isFinite(ttl)) ttl = 6 * 3600000
            routeCache = Routing.put(routeCache, job.cacheKey, Routing.cacheEntry(result, now, ttl), 100)
            var observed = result.value.typicalMinutes === null ? result.value.travelMinutes : result.value.typicalMinutes
            places = Places.observeRoute(places, departure.destinationPlaceId || departure.destination, observed, now)
            providerMessage = ""
            applyRouteResult(job.departureId, result, now, false)
            return
        }
        var stale = Routing.cached(routeCache, job.cacheKey, now, true)
        if (stale) {
            applyRouteResult(job.departureId, { ok: true, provider: stale.provider, value: stale.value }, now, true)
            providerMessage = result.error.message + "; using cached route"
        } else {
            applyRouteResult(job.departureId, result, now, false)
            providerMessage = result.error.message + "; using remembered/manual timing"
        }
    }

    function applyRouteResult(id, result, now, cached) {
        var departure = recordById(id)
        if (!departure) return
        var applied = Routing.applyResult(departure, result, now)
        applied.departure.routeStatus = result.ok ? (cached ? "cached" : "live") : "fallback"
        departures = Domain.upsert(departures, applied.departure)
        refresh(now)
        requestSave()
    }

    function stateObject() {
        return {
            schemaVersion: 2,
            departures: departures,
            places: places,
            kits: kits,
            routeCache: routeCache,
            settings: settings,
            sentNotifications: sentNotifications
        }
    }

    function requestSave() {
        writeDirty = true
        if (!stateWriter.running) startWrite()
    }

    function startWrite() {
        if (!writeDirty || stateWriter.running) return
        writeDirty = false
        writePayload = JSON.stringify(stateObject(), null, 2) + "\n"
        stateWriter.command = ["bash", "-c",
            "set -eu\npath=$1\npayload=$2\ndir=${path%/*}\nmkdir -p -- \"$dir\"\ntmp=$(mktemp \"$dir/.state.XXXXXX\")\ntrap 'rm -f -- \"$tmp\"' EXIT\numask 077\nprintf '%s' \"$payload\" > \"$tmp\"\nchmod 600 \"$tmp\"\nmv -f -- \"$tmp\" \"$path\"\ntrap - EXIT",
            "departures-state", statePath, writePayload]
        stateWriter.running = true
    }

    function restore(raw) {
        if (hydrated) return
        var restored = []
        var restoredPlaces = []
        var restoredKits = []
        var restoredCache = {}
        var restoredSettings = settingsDefaults()
        var notifications = {}
        var migrated = false
        try {
            var decoded = Storage.decode(raw)
            if (!decoded.ok) throw new Error(decoded.error)
            var data = decoded.value
            migrated = decoded.migrated
            if (data && Array.isArray(data.departures)) {
                for (var i = 0; i < data.departures.length; i++) {
                    var record = Domain.restore(data.departures[i])
                    if (record) restored.push(record)
                }
                if (data.sentNotifications && typeof data.sentNotifications === "object") notifications = data.sentNotifications
                if (!migrated) {
                    var sourcePlaces = Array.isArray(data.places) ? data.places : []
                    for (var p = 0; p < sourcePlaces.length; p++) restoredPlaces = Places.upsert(restoredPlaces, sourcePlaces[p])
                    restoredKits = Array.isArray(data.kits) ? data.kits : []
                    restoredCache = data.routeCache && typeof data.routeCache === "object" ? data.routeCache : {}
                    restoredSettings = normalizedSettings(data.settings)
                }
            }
        } catch (error) {
            lastError = "State file could not be read; keeping it untouched"
        }
        departures = Domain.sort(restored)
        places = restoredPlaces
        kits = restoredKits
        routeCache = restoredCache
        settings = restoredSettings
        sentNotifications = NotificationState.prune(notifications, departures)
        hydrated = true
        refresh(Date.now())
        if (migrated) requestSave()
        Qt.callLater(function() { service.prepareAllNetwork() })
    }

    function resultJson(result) {
        return JSON.stringify(result || { ok: false, errors: ["Unknown error"] })
    }

    function addJson(payloadJson) {
        try { return resultJson(saveDeparture(JSON.parse(payloadJson || "{}"), "")) }
        catch (error) { return resultJson({ ok: false, errors: ["Payload must be valid JSON"] }) }
    }

    function updateJson(payloadJson) {
        try {
            var payload = JSON.parse(payloadJson || "{}")
            return resultJson(saveDeparture(payload, String(payload.id || "")))
        } catch (error) { return resultJson({ ok: false, errors: ["Payload must be valid JSON"] }) }
    }

    IpcHandler {
        target: "departures"
        function state(): string { return JSON.stringify(service.stateObject()) }
        function snapshot(): string { return JSON.stringify(service.snapshot) }
        function add(payloadJson: string): string { return service.addJson(payloadJson) }
        function natural(text: string): string { return service.resultJson(service.saveNatural(text)) }
        function update(payloadJson: string): string { return service.updateJson(payloadJson) }
        function remove(id: string): string { return JSON.stringify({ ok: service.deleteDeparture(id) }) }
    }

    FileView {
        id: stateFile
        path: service.statePath
        preload: true
        printErrors: false
        onLoaded: service.restore(stateFile.text())
        onLoadFailed: function(error) { service.restore("") }
    }

    Process {
        id: stateWriter
        running: false
        command: []
        stderr: StdioCollector { id: writerError; waitForEnd: true }
        onExited: function(code) {
            if (code !== 0) service.lastError = "Could not save departures: " + String(writerError.text || "write failed")
            else service.lastError = ""
            if (service.writeDirty) service.startWrite()
            else service.drainNotifications()
        }
    }

    Process {
        id: notificationProcess
        running: false
        command: []
        onExited: function(code) {
            if (code !== 0) service.lastError = "Desktop notification could not be sent"
            service.drainNotifications()
        }
    }

    Process {
        id: networkProcess
        running: false
        command: []
        stdout: StdioCollector { id: networkOutput; waitForEnd: true }
        stderr: StdioCollector { id: networkError; waitForEnd: true }
        onExited: function(code) { service.finishNetwork(code, networkOutput.text, networkError.text) }
    }

    Timer { id: networkDelay; interval: 1100; onTriggered: service.startNextNetwork() }

    Timer {
        interval: 15000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: service.refresh(Date.now())
    }
}
