pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "js/timing.js" as Timing
import "js/presentation.js" as Presentation

Item {
    id: details

    property var departure: null
    property var departuresService: null
    property bool routingExpanded: false
    property string actionMessage: ""
    readonly property var derived: Timing.derive(departure || {})
    readonly property var timingImpact: Presentation.impact(departure)
    signal backRequested()
    signal editRequested(var departure)
    signal deleteRequested(var departure)

    implicitHeight: content.implicitHeight

    function openFor(value) {
        departure = value
        routingExpanded = false
        actionMessage = ""
    }

    function safeTime(value) {
        return isFinite(Number(value)) ? Timing.localTime(value) : "—"
    }

    function retry() {
        if (!departuresService || !departure) return
        var result = departuresService.retryRoute(departure.id)
        actionMessage = result.ok ? "Trying automatic routing again…" : result.errors.join(" · ")
    }

    ColumnLayout {
        id: content
        width: parent.width
        spacing: Style.space(12)

        RowLayout {
            Layout.fillWidth: true
            Button { text: "←  BACK"; focusable: true; onClicked: details.backRequested() }
            Item { Layout.fillWidth: true }
            Button { text: "EDIT"; focusable: true; onClicked: details.editRequested(details.departure) }
            Button { text: "DELETE"; foreground: Color.urgent; focusable: true; onClicked: details.deleteRequested(details.departure) }
        }

        Text {
            Layout.fillWidth: true
            text: String(details.departure && details.departure.destination || "Departure")
            color: Color.foreground
            font.family: Style.font.family
            font.pixelSize: Style.font.display
            font.bold: true
            wrapMode: Text.Wrap
            maximumLineCount: 3
            elide: Text.ElideRight
        }

        Text {
            Layout.fillWidth: true
            text: String(details.departure && details.departure.title || "") + "  ·  "
                + Presentation.arrivalLabel(details.departure && details.departure.arrivalTime, Date.now())
            color: Color.foreground
            opacity: 0.62
            font.family: Style.font.family
            font.pixelSize: Style.font.body
            elide: Text.ElideRight
        }

        GridLayout {
            Layout.fillWidth: true
            columns: 2
            columnSpacing: Style.space(12)
            rowSpacing: Style.space(8)

            Repeater {
                model: [
                    { label: "Get ready", value: details.safeTime(details.derived.getReadyTime) },
                    { label: "Leave by", value: Presentation.hasUsableTiming(details.departure) ? details.safeTime(details.derived.leaveTime) : "—" },
                    { label: "Arrive by", value: details.safeTime(details.derived.targetArrivalTime) },
                    { label: "Travel", value: Presentation.travelLine(details.departure).replace(/^Travel /, "") }
                ]
                delegate: Rectangle {
                    id: timingCell
                    required property var modelData
                    Layout.fillWidth: true
                    Layout.preferredHeight: cellContent.implicitHeight + Style.space(18)
                    radius: Math.max(0, Style.cornerRadius)
                    color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.045)
                    ColumnLayout {
                        id: cellContent
                        anchors.fill: parent
                        anchors.margins: Style.space(9)
                        spacing: 1
                        Text { text: timingCell.modelData.label; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
                        Text { Layout.fillWidth: true; text: timingCell.modelData.value; color: Color.foreground; font.family: "monospace"; font.pixelSize: Style.font.body; font.bold: true; elide: Text.ElideRight }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: routeContent.implicitHeight + Style.space(20)
            radius: Math.max(0, Style.cornerRadius)
            color: details.timingImpact.level === "blocking"
                ? Qt.rgba(Color.urgent.r, Color.urgent.g, Color.urgent.b, 0.10)
                : Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.04)

            ColumnLayout {
                id: routeContent
                anchors.fill: parent
                anchors.margins: Style.space(10)
                spacing: Style.space(6)

                Text {
                    Layout.fillWidth: true
                    text: Presentation.routingTitle(details.departure)
                    color: details.timingImpact.level === "blocking" ? Color.urgent : Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.body
                    font.bold: true
                }
                Text {
                    Layout.fillWidth: true
                    text: Presentation.routingExplanation(details.departure)
                    color: Color.foreground
                    opacity: 0.62
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                    wrapMode: Text.WordWrap
                }

                RowLayout {
                    Layout.fillWidth: true
                    visible: details.departure && details.departure.timingMode === "auto"
                        && String(details.departure.routeStatus || "") === "fallback"
                    Button {
                        text: "RETRY"
                        enabled: details.departuresService && details.departuresService.settings.networkEnabled
                        focusable: true
                        onClicked: details.retry()
                    }
                    Button { text: "EDIT LOCATIONS"; focusable: true; onClicked: details.editRequested(details.departure) }
                    Item { Layout.fillWidth: true }
                }

                Button {
                    visible: details.departure && details.departure.timingMode === "auto"
                        && details.departuresService && !details.departuresService.settings.networkEnabled
                    text: "TURN ON AUTOMATIC ROUTING"
                    focusable: true
                    onClicked: {
                        var result = details.departuresService.updateSettings({ networkEnabled: true })
                        details.actionMessage = result.ok ? "Automatic routing is on" : result.errors.join(" · ")
                    }
                }

                Text {
                    Layout.fillWidth: true
                    visible: details.actionMessage !== ""
                    text: details.actionMessage
                    color: Color.foreground
                    opacity: 0.7
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                    wrapMode: Text.WordWrap
                }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            visible: details.departure && Array.isArray(details.departure.reminders) && details.departure.reminders.length > 0
            spacing: Style.space(4)
            Text { text: "REMINDERS"; color: Color.foreground; opacity: 0.5; font.family: Style.font.family; font.pixelSize: Style.font.caption }
            Text {
                Layout.fillWidth: true
                text: details.departure && Array.isArray(details.departure.reminders) ? details.departure.reminders.join("  ·  ") : ""
                color: Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                wrapMode: Text.WordWrap
            }
        }

        Button {
            text: details.routingExpanded ? "HIDE ROUTING DETAILS" : "ROUTING DETAILS"
            focusable: true
            onClicked: details.routingExpanded = !details.routingExpanded
        }

        ColumnLayout {
            Layout.fillWidth: true
            visible: details.routingExpanded
            spacing: Style.space(4)

            Text { text: "Provider: " + String(details.departure && details.departure.routeProvider || "Not selected"); color: Color.foreground; opacity: 0.55; font.family: "monospace"; font.pixelSize: Style.font.caption }
            Text { text: "Status: " + String(details.departure && details.departure.routeStatus || "Waiting"); color: Color.foreground; opacity: 0.55; font.family: "monospace"; font.pixelSize: Style.font.caption }
            Text {
                Layout.fillWidth: true
                visible: details.departure && String(details.departure.routeError || "") !== ""
                text: "Technical detail: " + String(details.departure && details.departure.routeError || "")
                color: Color.foreground
                opacity: 0.55
                font.family: "monospace"
                font.pixelSize: Style.font.caption
                wrapMode: Text.WordWrap
            }
            Text {
                visible: details.departure && Number(details.departure.routeCheckedAt || 0) > 0
                text: "Last checked: " + new Date(Number(details.departure && details.departure.routeCheckedAt || 0)).toLocaleString()
                color: Color.foreground
                opacity: 0.55
                font.family: "monospace"
                font.pixelSize: Style.font.caption
            }
            Button {
                visible: details.departuresService && details.departuresService.settings.networkEnabled
                text: "TURN OFF ROUTING"
                focusable: true
                onClicked: {
                    var result = details.departuresService.updateSettings({ networkEnabled: false })
                    details.actionMessage = result.ok ? "Automatic routing is off" : result.errors.join(" · ")
                }
            }
        }
    }
}
