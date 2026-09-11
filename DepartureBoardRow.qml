pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import "js/presentation.js" as Presentation

Item {
    id: row

    required property string departureId
    required property string arriveText
    required property string destination
    required property string leaveText
    required property string statusText
    required property string timingMode
    required property double effectiveTravelMinutes
    required property bool timingReliable
    required property string routeStatus
    required property double routeCheckedAt
    required property bool routeTrafficAware
    required property string dayHeading
    required property bool showDayHeading
    property double now: Date.now()
    signal activated(string departureId)

    readonly property real headingHeight: showDayHeading ? Style.space(30) : 0
    readonly property real rowHeight: Style.space(64)
    implicitHeight: headingHeight + rowHeight
    activeFocusOnTab: true
    Accessible.role: Accessible.ListItem
    Accessible.name: destination + ", arrive " + arriveText + ", leave " + leaveText + ", " + statusText
    Keys.onReturnPressed: row.activated(row.departureId)
    Keys.onEnterPressed: row.activated(row.departureId)

    Text {
        visible: row.showDayHeading
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: row.headingHeight
        verticalAlignment: Text.AlignVCenter
        text: row.dayHeading
        color: Color.accent
        opacity: 0.76
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
        font.bold: true
        font.letterSpacing: 1
    }

    Rectangle {
        id: surface
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: row.rowHeight
        color: pointer.containsMouse || row.activeFocus
            ? Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.075)
            : "transparent"
        border.width: row.activeFocus ? 1 : 0
        border.color: Color.accent

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: Style.space(8)
            anchors.rightMargin: Style.space(8)
            spacing: Style.space(12)

            Text {
                Layout.preferredWidth: Style.space(64)
                text: row.arriveText
                color: Color.foreground
                opacity: 0.68
                font.family: "monospace"
                font.pixelSize: Style.font.body
                horizontalAlignment: Text.AlignLeft
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 1
                Text {
                    Layout.fillWidth: true
                    text: row.destination.toUpperCase()
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.body
                    font.bold: true
                    elide: Text.ElideRight
                }
                Text {
                    Layout.fillWidth: true
                    text: Presentation.compactTimingLine(row.timingMode, row.effectiveTravelMinutes,
                        row.routeStatus, row.routeCheckedAt, row.now, row.routeTrafficAware)
                    color: Color.foreground
                    opacity: row.timingReliable ? 0.48 : 0.8
                    font.family: "monospace"
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                }
            }

            Text {
                Layout.preferredWidth: Style.space(92)
                text: row.leaveText
                color: row.timingReliable ? Color.accent : Color.urgent
                font.family: "monospace"
                font.pixelSize: Style.font.display
                font.bold: true
                horizontalAlignment: Text.AlignHCenter
            }

            Text {
                Layout.preferredWidth: Style.space(106)
                text: row.statusText
                color: row.statusText === "ROUTE NEEDED" || row.statusText === "LEAVE NOW"
                    ? Color.urgent : (row.statusText === "GET READY" || row.statusText === "LEAVE SOON"
                        ? Color.accent : Color.foreground)
                opacity: row.statusText === "ON TIME" ? 0.62 : 1
                font.family: "monospace"
                font.pixelSize: Style.font.caption
                font.bold: true
                horizontalAlignment: Text.AlignRight
                wrapMode: Text.WordWrap
            }
        }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 1
            color: Color.foreground
            opacity: 0.10
        }

        MouseArea {
            id: pointer
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: {
                row.forceActiveFocus()
                row.activated(row.departureId)
            }
        }
    }
}
