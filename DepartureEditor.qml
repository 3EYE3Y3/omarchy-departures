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
    property var reminderItems: []
    property string errorText: ""
    property bool loading: false
    readonly property bool editing: editingDeparture !== null
    readonly property var derived: Timing.derive(draft())
    signal saveRequested(var draft)
    signal cancelRequested()

    implicitHeight: form.implicitHeight

    function defaultArrival() {
        var date = new Date(Date.now() + 90 * Timing.MINUTE_MS)
        date.setMinutes(0, 0, 0)
        date.setHours(date.getHours() + 1)
        return date.getTime()
    }

    function openFor(departure) {
        loading = true
        editingDeparture = departure || null
        errorText = ""
        var arrival = departure ? Number(departure.arrivalTime) : defaultArrival()
        titleField.text = departure ? String(departure.title || "") : ""
        destinationField.text = departure ? String(departure.destination || "") : ""
        dateField.text = Timing.localDate(arrival)
        timeField.text = Timing.localTime(arrival)
        travelField.value = departure ? Number(departure.travelMinutes) : 20
        bufferField.value = departure ? Number(departure.arrivalBufferMinutes) : 5
        preparationField.value = departure ? Number(departure.preparationMinutes) : 15
        transportField.value = departure ? String(departure.transportMode || "drive") : "drive"
        profileField.value = departure ? String(departure.profile || "custom") : "custom"
        reminderItems = departure && Array.isArray(departure.reminders) ? departure.reminders.slice() : []
        notesField.text = departure ? String(departure.notes || "") : ""
        reminderField.text = ""
        loading = false
        Qt.callLater(function() { titleField.forceActiveFocus() })
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
            arrivalTime: dateField && timeField ? Timing.localDateTime(dateField.text, timeField.text) : NaN,
            travelMinutes: travelField ? travelField.value : 0,
            arrivalBufferMinutes: bufferField ? bufferField.value : 0,
            preparationMinutes: preparationField ? preparationField.value : 0,
            transportMode: transportField ? transportField.value : "drive",
            profile: profileField ? profileField.value : "custom",
            reminders: reminderItems,
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
            TextField { id: titleField; Layout.fillWidth: true; placeholderText: "School pickup"; maximumLength: 80; onAccepted: destinationField.forceActiveFocus() }

            Text { text: "DESTINATION"; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            TextField { id: destinationField; Layout.fillWidth: true; placeholderText: "Example City"; maximumLength: 120; onAccepted: dateField.forceActiveFocus() }

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
            NumberField { id: travelField; label: "TRAVEL  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(24)) / 3 : Style.space(150); onModified: function(next) { value = next } }
            NumberField { id: bufferField; label: "BUFFER  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(24)) / 3 : Style.space(150); onModified: function(next) { value = next } }
            NumberField { id: preparationField; label: "PREP  MIN"; from: 0; to: 2880; Layout.fillWidth: true; fieldWidth: parent ? (parent.width - Style.space(24)) / 3 : Style.space(150); onModified: function(next) { value = next } }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Style.space(12)
            Dropdown { id: transportField; label: "TRANSPORT"; options: Profiles.transportOptions(); Layout.fillWidth: true }
            Dropdown { id: profileField; label: "PROFILE"; options: Profiles.options(); Layout.fillWidth: true; onChanged: function(value) { editor.applyProfile(value) } }
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
