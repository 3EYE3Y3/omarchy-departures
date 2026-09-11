pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC
import qs.Commons
import qs.Ui

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
    property double savedBoardContentY: 0
    readonly property int boardCount: departuresService ? departuresService.boardCount : 0
    readonly property var allDepartures: departuresService ? departuresService.departures : []
    readonly property bool hydrated: departuresService && departuresService.hydrated
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

    function beginDetailsById(id) {
        var departure = null
        var records = departuresService ? departuresService.departures : []
        for (var i = 0; i < records.length; i++)
            if (String(records[i].id) === String(id)) departure = records[i]
        if (!departure) return
        savedBoardContentY = boardList.contentY
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
        Qt.callLater(function() {
            boardList.contentY = Math.max(0, Math.min(root.savedBoardContentY,
                Math.max(0, boardList.contentHeight - boardList.height)))
            keyCatcher.forceActiveFocus()
        })
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
        contentWidth: fittedContentWidth(Style.space(720))
        contentHeight: fittedContentHeight(Math.min(Style.space(780), content.implicitHeight))

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
                    spacing: Style.space(10)

                    RowLayout {
                        Layout.fillWidth: true
                        Text {
                            text: "󰁕  DEPARTURES"
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.title
                            font.bold: true
                            font.letterSpacing: 0.8
                            Layout.fillWidth: true
                        }
                        Text {
                            text: new Date(root.currentNow).toLocaleDateString(Qt.locale(), "ddd dd MMM").toUpperCase()
                            color: Color.foreground
                            opacity: 0.54
                            font.family: "monospace"
                            font.pixelSize: Style.font.caption
                        }
                    }

                    Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Color.foreground; opacity: 0.18 }

                    Text {
                        visible: !root.hydrated
                        text: "Loading departures…"
                        color: Color.foreground
                        opacity: 0.58
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        Layout.alignment: Qt.AlignHCenter
                        Layout.topMargin: Style.space(32)
                        Layout.bottomMargin: Style.space(32)
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        visible: root.hydrated && root.boardCount === 0
                        Layout.topMargin: Style.space(28)
                        Layout.bottomMargin: Style.space(28)
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
                                ? "Know when to get ready and when to leave."
                                : "Your previous departures have passed."
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

                    RowLayout {
                        visible: root.boardCount > 0
                        Layout.fillWidth: true
                        Layout.leftMargin: Style.space(8)
                        Layout.rightMargin: Style.space(8)
                        spacing: Style.space(12)
                        Text { Layout.preferredWidth: Style.space(64); text: "ARRIVE"; color: Color.foreground; opacity: 0.42; font.family: "monospace"; font.pixelSize: Style.font.caption }
                        Text { Layout.fillWidth: true; text: "DESTINATION"; color: Color.foreground; opacity: 0.42; font.family: "monospace"; font.pixelSize: Style.font.caption }
                        Text { Layout.preferredWidth: Style.space(92); text: "LEAVE"; color: Color.accent; opacity: 0.72; font.family: "monospace"; font.pixelSize: Style.font.caption; horizontalAlignment: Text.AlignHCenter }
                        Text { Layout.preferredWidth: Style.space(106); text: "STATUS"; color: Color.foreground; opacity: 0.42; font.family: "monospace"; font.pixelSize: Style.font.caption; horizontalAlignment: Text.AlignRight }
                    }

                    ListView {
                        id: boardList
                        visible: root.boardCount > 0
                        Layout.fillWidth: true
                        Layout.preferredHeight: Math.min(contentHeight, Style.space(490))
                        implicitHeight: Layout.preferredHeight
                        clip: true
                        boundsBehavior: Flickable.StopAtBounds
                        reuseItems: true
                        cacheBuffer: Style.space(160)
                        model: root.departuresService ? root.departuresService.boardModel : null
                        delegate: DepartureBoardRow {
                            width: ListView.view.width
                            now: root.currentNow
                            onActivated: function(departureId) { root.beginDetailsById(departureId) }
                        }
                    }

                    Rectangle {
                        visible: root.boardCount > 0
                        Layout.fillWidth: true
                        Layout.preferredHeight: nextContent.implicitHeight + Style.space(18)
                        color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.07)
                        radius: Math.max(0, Style.cornerRadius)

                        RowLayout {
                            id: nextContent
                            anchors.fill: parent
                            anchors.margins: Style.space(9)
                            spacing: Style.space(12)
                            Text {
                                text: "NEXT"
                                color: Color.foreground
                                opacity: 0.46
                                font.family: "monospace"
                                font.pixelSize: Style.font.caption
                                font.bold: true
                            }
                            Text {
                                Layout.fillWidth: true
                                text: root.departuresService ? root.departuresService.nextAction.toUpperCase() : ""
                                color: Color.accent
                                font.family: Style.font.family
                                font.pixelSize: Style.font.body
                                font.bold: true
                                wrapMode: Text.WordWrap
                            }
                            Button { text: "+  ADD"; selected: true; focusable: true; onClicked: root.beginCreate() }
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
                        now: root.currentNow
                        onBackRequested: root.leaveSubview()
                        onEditRequested: function(departure) { root.beginEdit(departure) }
                        onDeleteRequested: function(departure) { root.requestDelete(departure) }
                    }
                }
            }
        }
    }
}
