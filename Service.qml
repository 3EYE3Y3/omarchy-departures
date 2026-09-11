pragma ComponentBehavior: Bound
import QtQuick
import Quickshell
import Quickshell.Io
import "js/timing.js" as Timing
import "js/domain.js" as Domain
import "js/notification_state.js" as NotificationState

Item {
    id: service

    property var shell: null
    property var manifest: null
    readonly property string stateHome: {
        var configured = Quickshell.env("XDG_STATE_HOME")
        return configured && configured !== "" ? configured : Quickshell.env("HOME") + "/.local/state"
    }
    readonly property string statePath: stateHome + "/omarchy/departures/state.json"
    property var departures: []
    property var sentNotifications: ({})
    property var snapshot: Timing.snapshot([], Date.now())
    property bool hydrated: false
    property string lastError: ""
    property var notificationQueue: []
    property bool writeDirty: false
    property string writePayload: ""
    property int serial: 0

    readonly property string barText: snapshot ? snapshot.barText : "󰁕  No departures"
    readonly property var nextDeparture: snapshot ? snapshot.next : null
    readonly property var upcoming: snapshot ? snapshot.upcoming : []
    readonly property string nextAction: snapshot ? snapshot.nextAction : "NO UPCOMING DEPARTURES"

    function newId(now) {
        serial += 1
        return "dep-" + Math.round(now).toString(36) + "-" + serial.toString(36) + "-" + Math.floor(Math.random() * 1679616).toString(36)
    }

    function recordById(id) {
        for (var i = 0; i < departures.length; i++)
            if (String(departures[i].id) === String(id)) return departures[i]
        return null
    }

    function saveDeparture(input, editingId) {
        var now = Date.now()
        var existing = editingId ? recordById(editingId) : null
        var result = existing ? Domain.edit(existing, input, now) : Domain.create(input, now, newId(now))
        if (!result.ok) return result
        departures = Domain.upsert(departures, result.value)
        sentNotifications = NotificationState.prune(sentNotifications, departures)
        refresh(now)
        requestSave()
        return result
    }

    function deleteDeparture(id) {
        if (!recordById(id)) return false
        departures = Domain.remove(departures, id)
        sentNotifications = NotificationState.prune(sentNotifications, departures)
        refresh(Date.now())
        requestSave()
        return true
    }

    function refresh(now) {
        var timestamp = Number(now)
        if (!isFinite(timestamp)) timestamp = Date.now()
        snapshot = Timing.snapshot(departures, timestamp)
        if (hydrated) evaluateNotifications(timestamp)
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

    function stateObject() {
        return { schemaVersion: 1, departures: departures, sentNotifications: sentNotifications }
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
        var notifications = {}
        try {
            var data = JSON.parse(String(raw || "{}"))
            if (data && data.schemaVersion === 1 && Array.isArray(data.departures)) {
                for (var i = 0; i < data.departures.length; i++) {
                    var record = Domain.restore(data.departures[i])
                    if (record) restored.push(record)
                }
                if (data.sentNotifications && typeof data.sentNotifications === "object") notifications = data.sentNotifications
            }
        } catch (error) {
            lastError = "State file could not be read; keeping it untouched"
        }
        departures = Domain.sort(restored)
        sentNotifications = NotificationState.prune(notifications, departures)
        hydrated = true
        refresh(Date.now())
    }

    function resultJson(result) {
        return JSON.stringify(result || { ok: false, errors: ["Unknown error"] })
    }

    IpcHandler {
        target: "departures"

        function state(): string {
            return JSON.stringify(service.stateObject())
        }

        function snapshot(): string {
            return JSON.stringify(service.snapshot)
        }

        function add(payloadJson: string): string {
            try {
                return service.resultJson(service.saveDeparture(JSON.parse(payloadJson || "{}"), ""))
            } catch (error) {
                return service.resultJson({ ok: false, errors: ["Payload must be valid JSON"] })
            }
        }

        function update(payloadJson: string): string {
            try {
                var payload = JSON.parse(payloadJson || "{}")
                return service.resultJson(service.saveDeparture(payload, String(payload.id || "")))
            } catch (error) {
                return service.resultJson({ ok: false, errors: ["Payload must be valid JSON"] })
            }
        }

        function remove(id: string): string {
            return JSON.stringify({ ok: service.deleteDeparture(id) })
        }
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

    Timer {
        interval: 15000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: service.refresh(Date.now())
    }
}
