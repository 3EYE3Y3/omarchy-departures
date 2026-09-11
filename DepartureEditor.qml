pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui
import "js/timing.js" as Timing
import "js/profiles.js" as Profiles

Item {
    id: editor

    property var editingDeparture: null
    property var departuresService: null
    property var reminderItems: []
    property string errorText: ""
    property string infoText: ""
    property bool loading: false
    property string timingMode: "auto"
    property int manualTravelMinutes: 20
    property int autoTravelMinutes: 20
    property bool hasManualTravel: false
    readonly property bool editing: editingDeparture !== null
    readonly property var derived: Timing.derive(draft())
    signal saveRequested(var draft)
    signal cancelRequested()

    implicitHeight: form.implicitHeight

    function defaultArrival() {
        var date = new Date(Date.now() + 90 * Timing.MINUTE_MS)
        date.setSeconds(0, 0)
        date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15)
        return date.getTime()
    }

    function openFor(departure) {
        loading = true
        editingDeparture = departure || null
        errorText = ""
        infoText = ""
        var arrival = departure ? Number(departure.arrivalTime) : defaultArrival()
        var defaults = !departure && departuresService ? departuresService.defaultsFor("", "") : null
        timingMode = departure ? String(departure.timingMode || "auto") : "auto"
        autoTravelMinutes = departure ? Number(departure.autoTravelMinutes) : (defaults ? defaults.autoTravelMinutes : 20)
        var storedManual = departure && departure.manualTravelMinutes !== null
            && departure.manualTravelMinutes !== undefined ? Number(departure.manualTravelMinutes) : NaN
        hasManualTravel = isFinite(storedManual) && storedManual >= 0
        manualTravelMinutes = hasManualTravel ? storedManual : autoTravelMinutes
        titleField.text = departure ? String(departure.title || "") : ""
        destinationField.text = departure ? String(departure.destination || "") : ""
        originField.text = departure ? String(departure.origin || "") : (defaults ? String(defaults.origin || "") : "")
        dateField.text = Timing.localDate(arrival)
        timeField.text = Timing.localTime(arrival)
        bufferField.value = departure ? Number(departure.arrivalBufferMinutes) : (defaults ? defaults.arrivalBufferMinutes : 5)
        preparationField.value = departure ? Number(departure.preparationMinutes) : (defaults ? defaults.preparationMinutes : 15)
        parkingField.value = departure ? Number(departure.parkingMinutes || 0) : 0
        walkingField.value = departure ? Number(departure.walkingMinutes || 0) : 0
        transportField.value = departure ? String(departure.transportMode || "drive") : "drive"
        profileField.value = departure ? String(departure.profile || "custom") : "custom"
        reminderItems = departure && Array.isArray(departure.reminders) ? departure.reminders.slice() : []
        rememberKit.checked = departure ? departure.rememberKit !== false : true
        notesField.text = departure ? String(departure.notes || "") : ""
        reminderField.text = ""
        loading = false
        Qt.callLater(function() { titleField.forceActiveFocus() })
    }

    function setTimingMode(mode) {
        var next = String(mode) === "manual" ? "manual" : "auto"
        if (next === timingMode) return
        if (next === "manual" && !hasManualTravel) {
            manualTravelMinutes = Timing.manualTravelMinutesForSwitch({ timingMode: "auto", autoTravelMinutes: autoTravelMinutes })
            hasManualTravel = true
        }
        timingMode = next
        infoText = next === "manual" ? "Manual travel time is fixed" : "Automatic routing controls travel time"
    }

    function useSuggestions() {
        if (!departuresService) return
        var values = departuresService.defaultsFor(titleField.text, destinationField.text)
        if (values.origin && !originField.text) originField.text = values.origin
        if (timingMode === "manual") {
            manualTravelMinutes = values.manualTravelMinutes
            hasManualTravel = true
        } else autoTravelMinutes = values.autoTravelMinutes
        bufferField.value = values.arrivalBufferMinutes
        preparationField.value = values.preparationMinutes
        parkingField.value = values.parkingMinutes
        walkingField.value = values.walkingMinutes
        reminderItems = values.reminders.slice()
        infoText = values.rememberedPlace ? "Remembered place defaults applied" : "Activity kit and local defaults applied"
    }

    function applyProfile(name) {
        if (loading) return
        var preset = Profiles.profile(name)
        preparationField.value = preset.preparationMinutes
        bufferField.value = preset.arrivalBufferMinutes
        transportField.value = preset.transportMode
        reminderItems = preset.reminders.slice()
    }

    function addReminder() {
        var value = String(reminderField.text || "").replace(/^\s+|\s+$/g, "")
        if (!value) return
        for (var i = 0; i < reminderItems.length; i++) {
            if (String(reminderItems[i]).toLowerCase() === value.toLowerCase()) {
                reminderField.text = ""
                return
            }
        }
        if (reminderItems.length < 12) reminderItems = reminderItems.concat([value.slice(0, 50)])
        reminderField.text = ""
    }

    function removeReminder(index) {
        var next = reminderItems.slice()
        next.splice(index, 1)
        reminderItems = next
    }

    function draft() {
        return {
            title: titleField ? titleField.text : "",
            destination: destinationField ? destinationField.text : "",
            origin: originField ? originField.text : "",
            arrivalTime: dateField && timeField ? Timing.localDateTime(dateField.text, timeField.text) : NaN,
            timingMode: timingMode,
            manualTravelMinutes: hasManualTravel ? manualTravelMinutes : null,
            autoTravelMinutes: autoTravelMinutes,
            arrivalBufferMinutes: bufferField ? bufferField.value : 0,
            preparationMinutes: preparationField ? preparationField.value : 0,
            parkingMinutes: parkingField ? parkingField.value : 0,
            walkingMinutes: walkingField ? walkingField.value : 0,
            transportMode: transportField ? transportField.value : "drive",
            profile: profileField ? profileField.value : "custom",
            reminders: reminderItems,
            readyItems: editingDeparture && Array.isArray(editingDeparture.readyItems) ? editingDeparture.readyItems : [],
            kitKey: profileField && profileField.value !== "custom" ? profileField.value : titleField.text,
            rememberKit: rememberKit.checked,
            notes: notesField ? notesField.text : ""
        }
    }

    function submit() {
        addReminder()
        saveRequested(draft())
    }

    ColumnLayout {
        id: form
        width: parent.width
        spacing: Style.space(12)

        RowLayout {
            Layout.fillWidth: true
            Text {
                text: editor.editing ? "EDIT DEPARTURE" : "NEW DEPARTURE"
                color: Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.title
                font.bold: true
                Layout.fillWidth: true
            }
            Text {
                text: "KNOW WHEN TO GO"
                color: Color.accent
                opacity: 0.8
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.letterSpacing: 1
            }
        }

        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.16 }

        GridLayout {
            Layout.fillWidth: true
            columns: 2
            columnSpacing: Style.space(12)
            rowSpacing: Style.space(9)

            Text { text: "TITLE"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            TextField { id: titleField; Layout.fillWidth: true; placeholderText: "Morning meeting"; maximumLength: 80; onAccepted: destinationField.forceActiveFocus() }

            Text { text: "DESTINATION"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            TextField { id: destinationField; Layout.fillWidth: true; placeholderText: "Central Office"; maximumLength: 120; onAccepted: dateField.forceActiveFocus() }

            Text { text: "ORIGIN  OPTIONAL"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            TextField { id: originField; Layout.fillWidth: true; placeholderText: "123 Example Street or Current location"; maximumLength: 120 }

            Text { text: "ARRIVAL"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            RowLayout {
                Layout.fillWidth: true
                TextField { id: dateField; Layout.fillWidth: true; placeholderText: "YYYY-MM-DD"; inputMethodHints: Qt.ImhDate; maximumLength: 10 }
                TextField { id: timeField; Layout.preferredWidth: Style.space(92); placeholderText: "HH:MM"; inputMethodHints: Qt.ImhTime; maximumLength: 5 }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Style.space(12)
            ColumnLayout {
                spacing: Style.space(5)
                Text { text: "TIMING MODE"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                ButtonGroup {
                    id: timingModeField
                    options: [{ value: "auto", label: "AUTO" }, { value: "manual", label: "MANUAL" }]
                    value: editor.timingMode
                    onChanged: function(value) { editor.setTimingMode(value) }
                }
            }
            Item { Layout.fillWidth: true }
            ColumnLayout {
                spacing: Style.space(3)
                Text { text: "TRAVEL TIME"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                Text {
                    text: editor.timingMode === "auto"
                        ? editor.autoTravelMinutes + " min  ·  AUTO" + (editor.editingDeparture && editor.editingDeparture.routeProvider ? " · " + String(editor.editingDeparture.routeProvider).toUpperCase() : "MATIC ROUTING")
                        : editor.manualTravelMinutes + " min  ·  FIXED"
                    color: editor.timingMode === "auto" ? Color.accent : Color.foreground
                    font.family: "monospace"
                    font.pixelSize: Style.font.body
                    font.bold: true
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Style.space(12)
            NumberField {
                id: travelField
                label: editor.timingMode === "manual" ? "TRAVEL  MIN" : "TRAVEL  MIN · AUTO"
                from: 0
                to: 2880
                value: editor.timingMode === "manual" ? editor.manualTravelMinutes : editor.autoTravelMinutes
                enabled: editor.timingMode === "manual"
                opacity: enabled ? 1 : 0.38
                Layout.fillWidth: true
                fieldWidth: parent ? (parent.width - Style.space(24)) / 3 : Style.space(150)
                onModified: function(next) {
                    if (editor.timingMode === "manual") {
                        editor.manualTravelMinutes = next
                        editor.hasManualTravel = true
                    }
                }
            }
            NumberField { id: bufferField; label: "BUFFER  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(24)) / 3 : Style.space(150); onModified: function(next) { value = next } }
            NumberField { id: preparationField; label: "PREP  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(24)) / 3 : Style.space(150); onModified: function(next) { value = next } }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Style.space(12)
            NumberField { id: parkingField; label: "PARKING  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(12)) / 2 : Style.space(220); onModified: function(next) { value = next } }
            NumberField { id: walkingField; label: "WALKING  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(12)) / 2 : Style.space(220); onModified: function(next) { value = next } }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Style.space(12)
            Dropdown { id: transportField; label: "TRANSPORT"; options: Profiles.transportOptions(); Layout.fillWidth: true }
            Dropdown { id: profileField; label: "PROFILE"; options: Profiles.options(); Layout.fillWidth: true; onChanged: function(value) { editor.applyProfile(value) } }
            Button { text: "USE REMEMBERED"; fontSize: Style.font.caption; focusable: true; onClicked: editor.useSuggestions() }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: previewGrid.implicitHeight + Style.space(20)
            color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.07)
            radius: Math.max(0, Style.cornerRadius)

            GridLayout {
                id: previewGrid
                anchors.fill: parent
                anchors.margins: Style.space(10)
                columns: 4
                columnSpacing: Style.space(16)
                Repeater {
                    model: [
                        { label: "GET READY", value: editor.derived && isFinite(editor.derived.getReadyTime) ? Timing.localTime(editor.derived.getReadyTime) : "—" },
                        { label: "LEAVE", value: editor.derived && isFinite(editor.derived.leaveTime) ? Timing.localTime(editor.derived.leaveTime) : "—", accent: true },
                        { label: "ARRIVE", value: editor.derived && isFinite(editor.derived.targetArrivalTime) ? Timing.localTime(editor.derived.targetArrivalTime) : "—" },
                        { label: "EVENT", value: editor.derived && isFinite(editor.derived.eventTime) ? Timing.localTime(editor.derived.eventTime) : "—" }
                    ]
                    delegate: ColumnLayout {
                        id: previewValue
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: Style.space(2)
                        Text { text: previewValue.modelData.label; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                        Text { text: previewValue.modelData.value; color: previewValue.modelData.accent ? Color.accent : Color.foreground; font.family: "monospace"; font.pixelSize: previewValue.modelData.accent ? Style.font.title : Style.font.body; font.bold: previewValue.modelData.accent === true }
                    }
                }
            }
        }

        Text { text: "REMINDERS"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
        RowLayout {
            Layout.fillWidth: true
            TextField { id: reminderField; Layout.fillWidth: true; placeholderText: "Laptop, keys, water…"; maximumLength: 50; onAccepted: editor.addReminder() }
            Button { text: "ADD"; focusable: true; onClicked: editor.addReminder() }
        }
        Flow {
            Layout.fillWidth: true
            spacing: Style.space(6)
            visible: editor.reminderItems.length > 0
            Repeater {
                model: editor.reminderItems
                delegate: Button {
                    required property string modelData
                    required property int index
                    text: modelData + "  ×"
                    bordered: true
                    fontSize: Style.font.caption
                    horizontalPadding: Style.space(7)
                    verticalPadding: Style.space(4)
                    onClicked: editor.removeReminder(index)
                }
            }
        }

        QQC.CheckBox {
            id: rememberKit
            text: "Remember these items for this activity"
            palette.windowText: Color.foreground
            font.family: Style.font.family
            font.pixelSize: Style.font.bodySmall
        }

        Text { text: "NOTES  OPTIONAL"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
        QQC.TextArea {
            id: notesField
            Layout.fillWidth: true
            Layout.preferredHeight: Style.space(58)
            color: Color.foreground
            font.family: Style.font.family
            font.pixelSize: Style.font.body
            placeholderText: "Gate, meeting point, or anything useful before leaving"
            wrapMode: TextEdit.Wrap
            selectByMouse: true
            background: Rectangle {
                color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, notesField.activeFocus ? 0.08 : 0.04)
                border.width: notesField.activeFocus ? 1 : 0
                border.color: Color.accent
                radius: Style.cornerRadius
            }
        }

        Text {
            visible: editor.infoText !== ""
            text: editor.infoText
            color: Color.accent
            font.family: Style.font.family
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
        }

        Text {
            visible: editor.errorText !== ""
            text: editor.errorText
            color: Color.urgent
            font.family: Style.font.family
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
        }

        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            Button { text: "CANCEL"; focusable: true; onClicked: editor.cancelRequested() }
            Button { text: editor.editing ? "SAVE CHANGES" : "CREATE DEPARTURE"; selected: true; focusable: true; onClicked: editor.submit() }
        }
    }
}
