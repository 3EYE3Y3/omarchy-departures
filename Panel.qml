pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui
import "js/timing.js" as Timing
import "js/presentation.js" as Presentation

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
    property string selectedId: ""
    property string pendingDeleteId: ""
    property bool quickOpen: false
    property string quickError: ""
    readonly property var upcoming: departuresService ? departuresService.upcoming : []
    readonly property var allDepartures: departuresService ? departuresService.departures : []
    readonly property double currentNow: departuresService && departuresService.snapshot
        ? Number(departuresService.snapshot.now) : Date.now()
    readonly property var selectedDeparture: selectedRecord()

    function selectedRecord() {
        var records = departuresService ? departuresService.departures : []
        for (var i = 0; i < records.length; i++)
            if (String(records[i].id) === selectedId) return records[i]
        return null
    }

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
        if (!departure) return
        editingId = String(departure.id)
        view = "editor"
        editor.openFor(departure)
    }

    function beginDetails(departure) {
        if (!departure) return
        selectedId = String(departure.id)
        view = "details"
        details.routingExpanded = false
        details.actionMessage = ""
    }

    function leaveSubview() {
        view = "board"
        editingId = ""
        selectedId = ""
        pendingDeleteId = ""
        editor.errorText = ""
        keyCatcher.forceActiveFocus()
    }

    function saveDraft(draft) {
        if (!departuresService) {
            editor.errorText = "Departures is still starting. Try again in a moment."
            return
        }
        var result = departuresService.saveDeparture(draft, editingId)
        if (!result.ok) {
            editor.errorText = result.errors.join(" · ")
            return
        }
        leaveSubview()
    }

    function requestDelete(departure) {
        if (!departure) return
        var id = String(departure.id)
        if (pendingDeleteId === id) {
            if (departuresService) departuresService.deleteDeparture(id)
            leaveSubview()
        } else {
            pendingDeleteId = id
            details.actionMessage = "Press Delete again to confirm"
            deleteReset.restart()
        }
    }

    function createNatural() {
        if (!departuresService) return
        var result = departuresService.saveNatural(quickField.text)
        if (!result.ok) {
            quickError = result.errors ? result.errors.join(" · ") : "Add a destination, date, and time"
            return
        }
        quickField.text = ""
        quickError = ""
        quickOpen = false
        keyCatcher.forceActiveFocus()
    }

    Timer {
        id: deleteReset
        interval: 4000
        onTriggered: {
            root.pendingDeleteId = ""
            if (details.actionMessage === "Press Delete again to confirm") details.actionMessage = ""
        }
    }

    KeyboardPanel {
        id: popup
        anchorItem: root.anchorItem
        owner: root.hostWidget || root
        bar: root.bar
        open: root.opened
        focusTarget: keyCatcher
        contentWidth: fittedContentWidth(Style.space(620))
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
            Keys.onEscapePressed: root.view === "board" ? root.close() : root.leaveSubview()

            Item {
                id: content
                anchors.fill: parent
                implicitHeight: root.view === "editor" ? editor.implicitHeight
                    : (root.view === "details" ? details.implicitHeight : board.implicitHeight)

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
                        Button {
                            visible: root.upcoming.length > 0
                            text: root.quickOpen ? "CLOSE QUICK ADD" : "QUICK ADD"
                            focusable: true
                            onClicked: {
                                root.quickOpen = !root.quickOpen
                                if (root.quickOpen) Qt.callLater(function() { quickField.forceActiveFocus() })
                            }
                        }
                    }

                    Text {
                        Layout.fillWidth: true
                        text: "Know when to get ready and when to leave."
                        color: Color.foreground
                        opacity: 0.58
                        font.family: Style.font.family
                        font.pixelSize: Style.font.bodySmall
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        visible: root.quickOpen && root.upcoming.length > 0
                        spacing: Style.space(5)
                        RowLayout {
                            Layout.fillWidth: true
                            TextField {
                                id: quickField
                                Layout.fillWidth: true
                                placeholderText: "Morning meeting tomorrow at 9 at Central Office"
                                maximumLength: 240
                                onAccepted: root.createNatural()
                            }
                            Button { text: "CREATE"; selected: true; focusable: true; onClicked: root.createNatural() }
                        }
                        Text {
                            visible: root.quickError !== ""
                            Layout.fillWidth: true
                            text: root.quickError
                            color: Color.foreground
                            opacity: 0.72
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            wrapMode: Text.WordWrap
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        visible: root.upcoming.length === 0
                        Layout.topMargin: Style.space(32)
                        Layout.bottomMargin: Style.space(32)
                        spacing: Style.space(12)

                        Text {
                            text: root.allDepartures.length === 0 ? "No departures yet" : "No upcoming departures"
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.title
                            font.bold: true
                            Layout.alignment: Qt.AlignHCenter
                        }
                        Text {
                            text: root.allDepartures.length === 0
                                ? "Add somewhere you need to be.\nDepartures will work backwards from your arrival time."
                                : "Your previous departures have passed.\nAdd the next place you need to be."
                            horizontalAlignment: Text.AlignHCenter
                            color: Color.foreground
                            opacity: 0.58
                            font.family: Style.font.family
                            font.pixelSize: Style.font.body
                            Layout.alignment: Qt.AlignHCenter
                        }
                        Button {
                            text: root.allDepartures.length === 0 ? "ADD YOUR FIRST DEPARTURE" : "+  ADD DEPARTURE"
                            selected: true
                            focusable: true
                            Layout.alignment: Qt.AlignHCenter
                            onClicked: root.beginCreate()
                        }
                    }

                    DepartureCard {
                        id: primaryCard
                        visible: root.upcoming.length > 0
                        Layout.fillWidth: true
                        departure: root.upcoming.length > 0 ? root.upcoming[0] : null
                        now: root.currentNow
                        onDetailsRequested: root.beginDetails(primaryCard.departure)
                        onAddRequested: root.beginCreate()
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        visible: root.upcoming.length > 1
                        spacing: Style.space(6)

                        Text {
                            text: "LATER"
                            color: Color.foreground
                            opacity: 0.45
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            font.bold: true
                            font.letterSpacing: 1
                        }

                        Repeater {
                            model: root.upcoming.length > 1 ? root.upcoming.slice(1) : []
                            delegate: Rectangle {
                                id: laterRow
                                required property var modelData
                                Layout.fillWidth: true
                                Layout.preferredHeight: laterContent.implicitHeight + Style.space(18)
                                radius: Math.max(0, Style.cornerRadius)
                                color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.035)

                                RowLayout {
                                    id: laterContent
                                    anchors.fill: parent
                                    anchors.margins: Style.space(9)
                                    spacing: Style.space(10)
                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 1
                                        Text {
                                            Layout.fillWidth: true
                                            text: String(laterRow.modelData.destination)
                                            color: Color.foreground
                                            font.family: Style.font.family
                                            font.pixelSize: Style.font.body
                                            font.bold: true
                                            elide: Text.ElideRight
                                        }
                                        Text {
                                            Layout.fillWidth: true
                                            text: Presentation.arrivalLabel(laterRow.modelData.arrivalTime, root.currentNow)
                                                + (Presentation.hasUsableTiming(laterRow.modelData)
                                                    ? "  ·  Leave " + Timing.localTime(laterRow.modelData.leaveTime)
                                                    : "  ·  Check timing")
                                                + "  ·  " + Presentation.travelLine(laterRow.modelData)
                                            color: Color.foreground
                                            opacity: 0.55
                                            font.family: Style.font.family
                                            font.pixelSize: Style.font.caption
                                            elide: Text.ElideRight
                                        }
                                    }
                                    Button { text: "DETAILS"; focusable: true; onClicked: root.beginDetails(laterRow.modelData) }
                                }
                            }
                        }
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
                        departuresService: root.departuresService
                        onSaveRequested: function(draft) { root.saveDraft(draft) }
                        onCancelRequested: root.leaveSubview()
                    }
                }

                QQC.ScrollView {
                    visible: root.view === "details"
                    anchors.fill: parent
                    clip: true
                    QQC.ScrollBar.horizontal.policy: QQC.ScrollBar.AlwaysOff
                    DepartureDetails {
                        id: details
                        width: parent.width
                        departure: root.selectedDeparture
                        departuresService: root.departuresService
                        onBackRequested: root.leaveSubview()
                        onEditRequested: function(departure) { root.beginEdit(departure) }
                        onDeleteRequested: function(departure) { root.requestDelete(departure) }
                    }
                }
            }
        }
    }
}
