pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui
import "js/timing.js" as Timing
import "js/profiles.js" as Profiles

Panel {
    id: root
    moduleName: "io.github.3eye3y3.departures"
    ipcTarget: moduleName
    manageIpc: false

    property var anchorItem: null
    property var hostWidget: null
    property var departuresService: null
    property string view: "board"
    property string editingId: ""
    property string pendingDeleteId: ""
    readonly property var upcoming: departuresService ? departuresService.upcoming : []

    function open() {
        controller.show()
        if (departuresService) departuresService.refresh(Date.now())
        Qt.callLater(function() { keyCatcher.forceActiveFocus() })
    }

    function beginCreate() {
        editingId = ""
        view = "editor"
        editor.openFor(null)
    }

    function beginEdit(departure) {
        editingId = String(departure.id)
        view = "editor"
        editor.openFor(departure)
    }

    function leaveEditor() {
        view = "board"
        editingId = ""
        editor.errorText = ""
        keyCatcher.forceActiveFocus()
    }

    function saveDraft(draft) {
        if (!departuresService) {
            editor.errorText = "Departures service is not available"
            return
        }
        var result = departuresService.saveDeparture(draft, editingId)
        if (!result.ok) {
            editor.errorText = result.errors.join(" · ")
            return
        }
        leaveEditor()
    }

    function requestDelete(id) {
        if (pendingDeleteId === String(id)) {
            if (departuresService) departuresService.deleteDeparture(id)
            pendingDeleteId = ""
        } else {
            pendingDeleteId = String(id)
            deleteReset.restart()
        }
    }

    Timer { id: deleteReset; interval: 4000; onTriggered: root.pendingDeleteId = "" }

    KeyboardPanel {
        id: popup
        anchorItem: root.anchorItem
        owner: root.hostWidget || root
        bar: root.bar
        open: root.opened
        focusTarget: keyCatcher
        contentWidth: fittedContentWidth(Style.space(660))
        contentHeight: fittedContentHeight(Math.min(Style.space(760), content.implicitHeight))

        PanelKeyCatcher {
            id: keyCatcher
            anchors.fill: parent
            Keys.priority: Keys.BeforeItem
            Keys.onPressed: function(event) {
                if (root.view === "editor" && (event.modifiers & Qt.ControlModifier)
                        && (event.key === Qt.Key_Return || event.key === Qt.Key_Enter)) {
                    editor.submit()
                    event.accepted = true
                }
            }
            Keys.onEscapePressed: root.view === "editor" ? root.leaveEditor() : root.close()

            Item {
                id: content
                anchors.fill: parent
                implicitHeight: root.view === "editor" ? editor.implicitHeight : board.implicitHeight

                ColumnLayout {
                    id: board
                    visible: root.view === "board"
                    width: parent.width
                    spacing: Style.space(12)

                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            text: "󰁕  DEPARTURES"
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.title
                            font.bold: true
                            font.letterSpacing: 0.6
                            Layout.fillWidth: true
                        }
                        Text {
                            text: Qt.formatDateTime(new Date(root.departuresService && root.departuresService.snapshot ? root.departuresService.snapshot.now : Date.now()), "ddd dd MMM").toUpperCase()
                            color: Color.foreground
                            opacity: 0.6
                            font.family: "monospace"
                            font.pixelSize: Style.font.bodySmall
                        }
                    }

                    Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }

                    ColumnLayout {
                        visible: root.upcoming.length === 0
                        Layout.fillWidth: true
                        Layout.preferredHeight: Style.space(240)
                        spacing: Style.space(14)
                        Item { Layout.fillHeight: true }
                        Text { text: "NO UPCOMING DEPARTURES"; color: Color.foreground; font.family: "monospace"; font.pixelSize: Style.font.title; font.bold: true; Layout.alignment: Qt.AlignHCenter }
                        Text { text: "Add somewhere you need to be.\nDepartures will work backwards to your leave time."; horizontalAlignment: Text.AlignHCenter; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.body; Layout.alignment: Qt.AlignHCenter }
                        Button { text: "+  ADD DEPARTURE"; selected: true; focusable: true; Layout.alignment: Qt.AlignHCenter; onClicked: root.beginCreate() }
                        Item { Layout.fillHeight: true }
                    }

                    QQC.ScrollView {
                        visible: root.upcoming.length > 0
                        Layout.fillWidth: true
                        Layout.preferredHeight: Math.min(Style.space(485), departuresColumn.implicitHeight)
                        clip: true
                        QQC.ScrollBar.horizontal.policy: QQC.ScrollBar.AlwaysOff

                        Column {
                            id: departuresColumn
                            width: parent.width
                            spacing: 0

                            Repeater {
                                model: root.upcoming
                                delegate: Column {
                                    id: row
                                    required property var modelData
                                    width: departuresColumn.width
                                    spacing: Style.space(9)
                                    topPadding: Style.space(10)
                                    bottomPadding: Style.space(12)

                                    RowLayout {
                                        width: parent.width
                                        spacing: Style.space(14)
                                        ColumnLayout {
                                            Layout.preferredWidth: Style.space(88)
                                            spacing: 0
                                            Text { text: Timing.localTime(row.modelData.eventTime); color: Color.foreground; font.family: "monospace"; font.pixelSize: Style.font.title; font.bold: true }
                                            Text { text: Timing.dayLabel(row.modelData.eventTime, root.departuresService.snapshot.now); color: Color.foreground; opacity: 0.45; font.family: "monospace"; font.pixelSize: Style.font.caption }
                                        }
                                        ColumnLayout {
                                            Layout.fillWidth: true
                                            spacing: Style.space(2)
                                            Text { Layout.fillWidth: true; text: String(row.modelData.title).toUpperCase(); elide: Text.ElideRight; color: Color.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true }
                                            Text { Layout.fillWidth: true; text: String(row.modelData.destination); elide: Text.ElideRight; color: Color.foreground; opacity: 0.58; font.family: Style.font.family; font.pixelSize: Style.font.bodySmall }
                                        }
                                        ColumnLayout {
                                            Layout.preferredWidth: Style.space(150)
                                            spacing: 0
                                            Text { text: "LEAVE"; color: Color.accent; opacity: 0.72; font.family: Style.font.family; font.pixelSize: Style.font.caption; font.bold: true }
                                            Text { text: Timing.localTime(row.modelData.leaveTime); color: row.modelData.status === "LEAVE NOW" ? Color.urgent : Color.accent; font.family: "monospace"; font.pixelSize: Style.font.hero; font.bold: true }
                                        }
                                        ColumnLayout {
                                            spacing: Style.space(3)
                                            Button { text: "EDIT"; fontSize: Style.font.caption; horizontalPadding: Style.space(6); verticalPadding: Style.space(3); onClicked: root.beginEdit(row.modelData) }
                                            Button { text: root.pendingDeleteId === String(row.modelData.id) ? "CONFIRM" : "DELETE"; fontSize: Style.font.caption; foreground: root.pendingDeleteId === String(row.modelData.id) ? Color.urgent : Color.foreground; horizontalPadding: Style.space(6); verticalPadding: Style.space(3); onClicked: root.requestDelete(row.modelData.id) }
                                        }
                                    }

                                    RowLayout {
                                        width: parent.width
                                        spacing: Style.space(16)
                                        Item { Layout.preferredWidth: Style.space(102) }
                                        GridLayout {
                                            Layout.fillWidth: true
                                            columns: 3
                                            columnSpacing: Style.space(18)
                                            Repeater {
                                                model: [
                                                    { label: "GET READY", value: Timing.localTime(row.modelData.getReadyTime) },
                                                    { label: "ARRIVE", value: Timing.localTime(row.modelData.targetArrivalTime) },
                                                    { label: "EVENT", value: Timing.localTime(row.modelData.eventTime) }
                                                ]
                                                delegate: RowLayout {
                                                    id: boardTime
                                                    required property var modelData
                                                    Text { text: boardTime.modelData.label; color: Color.foreground; opacity: 0.45; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                                                    Text { text: boardTime.modelData.value; color: Color.foreground; font.family: "monospace"; font.pixelSize: Style.font.bodySmall }
                                                }
                                            }
                                        }
                                    }

                                    RowLayout {
                                        width: parent.width
                                        spacing: Style.space(8)
                                        Item { Layout.preferredWidth: Style.space(102) }
                                        Text {
                                            Layout.fillWidth: true
                                            text: row.modelData.travelMinutes + " min " + Profiles.transportLabel(row.modelData.transportMode).toLowerCase()
                                                + "  ·  " + row.modelData.arrivalBufferMinutes + " min buffer"
                                            color: Color.foreground
                                            opacity: 0.52
                                            font.family: Style.font.family
                                            font.pixelSize: Style.font.caption
                                        }
                                        Text { text: "●  " + row.modelData.status; color: row.modelData.status === "LEAVE NOW" ? Color.urgent : (row.modelData.status === "LEAVE SOON" ? Color.accent : Color.foreground); opacity: row.modelData.status === "ON TIME" ? 0.68 : 1; font.family: "monospace"; font.pixelSize: Style.font.caption; font.bold: true }
                                    }

                                    Text {
                                        visible: Array.isArray(row.modelData.reminders) && row.modelData.reminders.length > 0
                                            && ["GET READY", "LEAVE SOON", "LEAVE NOW"].indexOf(row.modelData.status) !== -1
                                        width: parent.width - Style.space(102)
                                        x: Style.space(102)
                                        text: "REMEMBER  " + (Array.isArray(row.modelData.reminders) ? row.modelData.reminders.join("  ·  ") : "")
                                        color: Color.accent
                                        font.family: Style.font.family
                                        font.pixelSize: Style.font.caption
                                        elide: Text.ElideRight
                                    }

                                    Rectangle { width: parent.width; height: 1; color: Color.foreground; opacity: 0.12 }
                                }
                            }
                        }
                    }

                    Rectangle {
                        visible: root.upcoming.length > 0
                        Layout.fillWidth: true
                        Layout.preferredHeight: nextActionColumn.implicitHeight + Style.space(20)
                        color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.07)
                        radius: Math.max(0, Style.cornerRadius)
                        ColumnLayout {
                            id: nextActionColumn
                            anchors.fill: parent
                            anchors.margins: Style.space(10)
                            spacing: Style.space(3)
                            Text { text: "NEXT ACTION"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption; font.bold: true }
                            Text { Layout.fillWidth: true; text: root.departuresService ? root.departuresService.nextAction : "NO UPCOMING DEPARTURES"; color: Color.accent; font.family: "monospace"; font.pixelSize: Style.font.title; font.bold: true; elide: Text.ElideRight }
                        }
                    }

                    RowLayout {
                        visible: root.upcoming.length > 0
                        Layout.fillWidth: true
                        Text { visible: root.departuresService && root.departuresService.lastError !== ""; text: root.departuresService ? root.departuresService.lastError : ""; color: Color.urgent; font.family: Style.font.family; font.pixelSize: Style.font.caption; Layout.fillWidth: true; elide: Text.ElideRight }
                        Item { Layout.fillWidth: !(root.departuresService && root.departuresService.lastError !== "") }
                        Button { text: "+  ADD DEPARTURE"; selected: true; focusable: true; onClicked: root.beginCreate() }
                    }
                }

                QQC.ScrollView {
                    visible: root.view === "editor"
                    anchors.fill: parent
                    clip: true
                    QQC.ScrollBar.horizontal.policy: QQC.ScrollBar.AlwaysOff
                    DepartureEditor {
                        id: editor
                        width: parent.width
                        onSaveRequested: function(draft) { root.saveDraft(draft) }
                        onCancelRequested: root.leaveEditor()
                    }
                }
            }
        }
    }
}
