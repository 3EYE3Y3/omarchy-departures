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
    property bool advancedOpen: false
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
        advancedOpen = false
        errorText = ""
        infoText = ""
        var arrival = departure ? Number(departure.arrivalTime) : defaultArrival()
        var defaults = !departure && departuresService ? departuresService.defaultsFor("", "") : null
        timingMode = departure ? String(departure.timingMode || "auto") : "auto"
        var storedAutomatic = departure ? Number(departure.autoTravelMinutes) : NaN
        autoTravelMinutes = isFinite(storedAutomatic) && storedAutomatic >= 0
            ? storedAutomatic : (defaults ? defaults.autoTravelMinutes : 20)
        var storedManual = departure && departure.manualTravelMinutes !== null
            && departure.manualTravelMinutes !== undefined ? Number(departure.manualTravelMinutes) : NaN
        hasManualTravel = isFinite(storedManual) && storedManual >= 0
        manualTravelMinutes = hasManualTravel ? storedManual : autoTravelMinutes
        destinationField.text = departure ? String(departure.destination || "") : ""
        originField.text = departure ? String(departure.origin || "") : (defaults ? String(defaults.origin || "") : "")
        dateField.text = Timing.localDate(arrival)
        timeField.text = Timing.localTime(arrival)
        titleField.text = departure ? String(departure.title || "") : ""
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
        Qt.callLater(function() { destinationField.forceActiveFocus() })
    }

    function setTimingMode(mode) {
        var next = String(mode) === "manual" ? "manual" : "auto"
        if (next === timingMode) return
        if (next === "manual" && !hasManualTravel) {
            manualTravelMinutes = Timing.manualTravelMinutesForSwitch({ timingMode: "auto", autoTravelMinutes: autoTravelMinutes })
            hasManualTravel = true
        }
        timingMode = next
        infoText = next === "manual" ? "This travel time stays fixed until you change it." : "Departures will refresh the estimate when routing is available."
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
        infoText = values.rememberedPlace ? "Saved defaults applied" : "Usual defaults applied"
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
        var destination = destinationField ? String(destinationField.text || "").replace(/^\s+|\s+$/g, "") : ""
        var title = titleField ? String(titleField.text || "").replace(/^\s+|\s+$/g, "") : ""
        return {
            title: title || destination,
            destination: destination,
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
            kitKey: profileField && profileField.value !== "custom" ? profileField.value : (title || destination),
            rememberKit: rememberKit.checked,
            notes: notesField ? notesField.text : ""
        }
    }

    function submit() {
        addReminder()
        saveRequested(draft())
    }

    function previewTime(value) {
        return isFinite(Number(value)) ? Timing.localTime(value) : "—"
    }

    ColumnLayout {
        id: form
        width: parent.width
        spacing: Style.space(13)

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
                opacity: 0.75
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.letterSpacing: 1
            }
        }

        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.12 }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: Style.space(5)
            Text { text: "Where are you going?"; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true }
            TextField {
                id: destinationField
                Layout.fillWidth: true
                placeholderText: "Central Office"
                maximumLength: 120
                onAccepted: dateField.forceActiveFocus()
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: Style.space(5)
            Text { text: "When do you need to be there?"; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true }
            RowLayout {
                Layout.fillWidth: true
                TextField { id: dateField; Layout.fillWidth: true; placeholderText: "YYYY-MM-DD"; inputMethodHints: Qt.ImhDate; maximumLength: 10 }
                TextField { id: timeField; Layout.preferredWidth: Style.space(104); placeholderText: "HH:MM"; inputMethodHints: Qt.ImhTime; maximumLength: 5 }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: Style.space(5)
            Text { text: "Where are you leaving from?"; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true }
            TextField {
                id: originField
                Layout.fillWidth: true
                placeholderText: "Optional — saved place or current location"
                maximumLength: 120
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: Style.space(6)
            Text { text: "Travel time"; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true }
            ButtonGroup {
                id: timingModeField
                options: [{ value: "auto", label: "AUTOMATIC" }, { value: "manual", label: "FIXED TIME" }]
                value: editor.timingMode
                onChanged: function(value) { editor.setTimingMode(value) }
            }
            Text {
                Layout.fillWidth: true
                visible: editor.timingMode === "auto"
                text: "Starts with " + editor.autoTravelMinutes + " min and refreshes when routing is available."
                color: Color.foreground
                opacity: 0.55
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                wrapMode: Text.WordWrap
            }
            NumberField {
                id: travelField
                visible: editor.timingMode === "manual"
                label: "TRAVEL  MINUTES"
                from: 0
                to: 2880
                value: editor.manualTravelMinutes
                Layout.fillWidth: true
                fieldWidth: Style.space(180)
                onModified: function(next) {
                    editor.manualTravelMinutes = next
                    editor.hasManualTravel = true
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: previewGrid.implicitHeight + Style.space(22)
            color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.07)
            radius: Math.max(0, Style.cornerRadius)

            GridLayout {
                id: previewGrid
                anchors.fill: parent
                anchors.margins: Style.space(11)
                columns: 3
                columnSpacing: Style.space(18)
                Repeater {
                    model: [
                        { label: "GET READY", value: editor.previewTime(editor.derived.getReadyTime) },
                        { label: "LEAVE BY", value: editor.previewTime(editor.derived.leaveTime), accent: true },
                        { label: "ARRIVE BY", value: editor.previewTime(editor.derived.targetArrivalTime) }
                    ]
                    delegate: ColumnLayout {
                        id: previewValue
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: Style.space(2)
                        Text { text: previewValue.modelData.label; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                        Text { text: previewValue.modelData.value; color: previewValue.modelData.accent ? Color.accent : Color.foreground; font.family: "monospace"; font.pixelSize: previewValue.modelData.accent ? Style.font.title : Style.font.body; font.bold: previewValue.modelData.accent === true }
                    }
                }
            }
        }

        Button {
            text: editor.advancedOpen ? "HIDE OPTIONS" : "MORE OPTIONS"
            focusable: true
            onClicked: editor.advancedOpen = !editor.advancedOpen
        }

        ColumnLayout {
            Layout.fillWidth: true
            visible: editor.advancedOpen
            spacing: Style.space(11)

            ColumnLayout {
                Layout.fillWidth: true
                spacing: Style.space(4)
                Text { text: "NAME  OPTIONAL"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                TextField { id: titleField; Layout.fillWidth: true; placeholderText: "Uses the destination if left blank"; maximumLength: 80 }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Style.space(12)
                NumberField { id: preparationField; label: "GET READY  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: Style.space(135); onModified: function(next) { value = next } }
                NumberField { id: bufferField; label: "ARRIVE EARLY  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: Style.space(135); onModified: function(next) { value = next } }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Style.space(12)
                NumberField { id: parkingField; label: "PARKING  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: Style.space(135); onModified: function(next) { value = next } }
                NumberField { id: walkingField; label: "WALKING  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: Style.space(135); onModified: function(next) { value = next } }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Style.space(12)
                Dropdown { id: transportField; label: "HOW YOU'RE TRAVELLING"; options: Profiles.transportOptions(); Layout.fillWidth: true }
                Dropdown { id: profileField; label: "USUAL CHECKLIST"; options: Profiles.options(); Layout.fillWidth: true; onChanged: function(value) { editor.applyProfile(value) } }
                Button { text: "USE SAVED DEFAULTS"; fontSize: Style.font.caption; focusable: true; onClicked: editor.useSuggestions() }
            }

            Text { text: "REMINDERS"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            RowLayout {
                Layout.fillWidth: true
                TextField { id: reminderField; Layout.fillWidth: true; placeholderText: "Notebook, keys, water…"; maximumLength: 50; onAccepted: editor.addReminder() }
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
                text: "Remember these items for similar departures"
                palette.windowText: Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
            }

            Text { text: "NOTES  OPTIONAL"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            QQC.TextArea {
                id: notesField
                Layout.fillWidth: true
                Layout.preferredHeight: Style.space(58)
                color: Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.body
                placeholderText: "Entrance, meeting point, or anything useful before leaving"
                wrapMode: TextEdit.Wrap
                selectByMouse: true
                background: Rectangle {
                    color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, notesField.activeFocus ? 0.08 : 0.04)
                    border.width: notesField.activeFocus ? 1 : 0
                    border.color: Color.accent
                    radius: Style.cornerRadius
                }
            }
        }

        Text {
            visible: editor.infoText !== ""
            Layout.fillWidth: true
            text: editor.infoText
            color: Color.foreground
            opacity: 0.68
            font.family: Style.font.family
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
        }

        Text {
            visible: editor.errorText !== ""
            Layout.fillWidth: true
            text: editor.errorText
            color: Color.urgent
            font.family: Style.font.family
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
        }

        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            Button { text: "CANCEL"; focusable: true; onClicked: editor.cancelRequested() }
            Button { text: editor.editing ? "SAVE CHANGES" : "ADD DEPARTURE"; selected: true; focusable: true; onClicked: editor.submit() }
        }
    }
}
