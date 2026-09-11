pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "js/timing.js" as Timing
import "js/presentation.js" as Presentation

Item {
    id: card

    property var departure: null
    property double now: Date.now()
    readonly property var timingImpact: Presentation.impact(departure)
    readonly property var derived: Timing.derive(departure || {})
    signal detailsRequested()
    signal addRequested()

    implicitHeight: surface.implicitHeight

    Rectangle {
        id: surface
        width: parent.width
        implicitHeight: content.implicitHeight + Style.space(28)
        radius: Math.max(0, Style.cornerRadius)
        color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.045)
        border.width: 1
        border.color: card.timingImpact.level === "blocking"
            ? Qt.rgba(Color.urgent.r, Color.urgent.g, Color.urgent.b, 0.7)
            : Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.12)

        ColumnLayout {
            id: content
            anchors.fill: parent
            anchors.margins: Style.space(14)
            spacing: Style.space(9)

            Text {
                text: "NEXT DEPARTURE"
                color: Color.accent
                opacity: 0.8
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.bold: true
                font.letterSpacing: 1
            }

            Text {
                Layout.fillWidth: true
                text: String(card.departure && card.departure.destination || "Destination")
                color: Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.display
                font.bold: true
                wrapMode: Text.Wrap
                maximumLineCount: 2
                elide: Text.ElideRight
            }

            Text {
                Layout.fillWidth: true
                visible: card.departure && String(card.departure.title || "").toLowerCase()
                    !== String(card.departure.destination || "").toLowerCase()
                text: String(card.departure && card.departure.title || "")
                color: Color.foreground
                opacity: 0.58
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                elide: Text.ElideRight
            }

            Text {
                text: Presentation.arrivalLabel(card.departure && card.departure.arrivalTime, card.now)
                color: Color.foreground
                opacity: 0.72
                font.family: "monospace"
                font.pixelSize: Style.font.body
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: actionText.implicitHeight + Style.space(20)
                radius: Math.max(0, Style.cornerRadius)
                color: card.timingImpact.level === "blocking"
                    ? Qt.rgba(Color.urgent.r, Color.urgent.g, Color.urgent.b, 0.10)
                    : Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.09)

                Text {
                    id: actionText
                    anchors.fill: parent
                    anchors.margins: Style.space(10)
                    text: card.timingImpact.level === "blocking"
                        ? card.timingImpact.title
                        : Timing.nextAction(card.departure, card.now)
                    color: card.timingImpact.level === "blocking" ? Color.urgent : Color.accent
                    font.family: Style.font.family
                    font.pixelSize: Style.font.title
                    font.bold: true
                    wrapMode: Text.WordWrap
                    verticalAlignment: Text.AlignVCenter
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: Style.space(20)

                ColumnLayout {
                    spacing: 0
                    Text { text: "Leave by"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                    Text {
                        text: Presentation.hasUsableTiming(card.departure) ? Timing.localTime(card.derived.leaveTime) : "—"
                        color: card.timingImpact.level === "blocking" ? Color.urgent : Color.foreground
                        font.family: "monospace"
                        font.pixelSize: Style.font.title
                        font.bold: true
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0
                    Text { text: "Travel time"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                    Text {
                        Layout.fillWidth: true
                        text: Presentation.travelLine(card.departure).replace(/^Travel /, "")
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        font.bold: true
                        elide: Text.ElideRight
                    }
                }
            }

            Text {
                Layout.fillWidth: true
                visible: card.timingImpact.message !== ""
                text: card.timingImpact.message
                color: card.timingImpact.level === "blocking" ? Color.urgent : Color.foreground
                opacity: card.timingImpact.level === "blocking" ? 1 : 0.56
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                wrapMode: Text.WordWrap
            }

            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                Button { text: "VIEW DETAILS"; focusable: true; onClicked: card.detailsRequested() }
                Button { text: "+  ADD"; selected: true; focusable: true; onClicked: card.addRequested() }
            }
        }
    }
}
