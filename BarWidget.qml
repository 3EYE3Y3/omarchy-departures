import QtQuick
import Quickshell.Io
import qs.Ui

BarWidget {
    id: root
    moduleName: "io.github.3eye3y3.departures"

    readonly property var departuresService: bar && bar.shell ? bar.shell.serviceFor(moduleName) : null
    readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

    function injectPanel() {
        var target = panelLoader.item
        if (!target) return
        target.bar = root.bar
        target.anchorItem = button
        target.hostWidget = root
        target.departuresService = root.departuresService
    }

    function open() {
        if (panelLoader.item) panelLoader.item.open()
    }

    function close() {
        if (panelLoader.item) panelLoader.item.close()
    }

    function toggle() {
        if (panelLoader.item) panelLoader.item.toggle()
    }

    function closeForPopoutSwitch() {
        if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
    }

    readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight
    onBarChanged: injectPanel()
    onDeparturesServiceChanged: injectPanel()

    Loader {
        id: panelLoader
        active: true
        source: Qt.resolvedUrl("Panel.qml")
        visible: false
        onLoaded: {
            root.injectPanel()
            Qt.callLater(root.injectPanel)
        }
    }

    IpcHandler {
        target: root.moduleName
        function open(): void { root.open() }
        function close(): void { root.close() }
        function show(): void { root.open() }
        function hide(): void { root.close() }
        function toggle(): void { root.toggle() }
        function compose(): void {
            root.open()
            Qt.callLater(function() {
                if (panelLoader.item) panelLoader.item.beginCreate()
            })
        }
        function state(): string {
            return root.departuresService ? JSON.stringify(root.departuresService.stateObject()) : "{}"
        }
        function snapshot(): string {
            return root.departuresService ? JSON.stringify(root.departuresService.snapshot) : "{}"
        }
        function add(payloadJson: string): string {
            return root.departuresService ? root.departuresService.addJson(payloadJson)
                : JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
        }
        function natural(text: string): string {
            return root.departuresService ? root.departuresService.resultJson(root.departuresService.saveNatural(text))
                : JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
        }
        function update(payloadJson: string): string {
            return root.departuresService ? root.departuresService.updateJson(payloadJson)
                : JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
        }
        function remove(id: string): string {
            return JSON.stringify({ ok: root.departuresService ? root.departuresService.deleteDeparture(id) : false })
        }
        function places(): string {
            return JSON.stringify(root.departuresService ? root.departuresService.places : [])
        }
        function setPlace(payloadJson: string): string {
            if (!root.departuresService) return JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
            try { return root.departuresService.resultJson(root.departuresService.setPlace(JSON.parse(payloadJson || "{}"))) }
            catch (error) { return root.departuresService.resultJson({ ok: false, errors: ["Payload must be valid JSON"] }) }
        }
        function removePlace(value: string): string {
            return JSON.stringify({ ok: root.departuresService ? root.departuresService.removePlace(value) : false })
        }
        function kits(): string {
            return JSON.stringify(root.departuresService ? root.departuresService.kits : [])
        }
        function setKit(payloadJson: string): string {
            if (!root.departuresService) return JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
            try { return root.departuresService.resultJson(root.departuresService.setKit(JSON.parse(payloadJson || "{}"))) }
            catch (error) { return root.departuresService.resultJson({ ok: false, errors: ["Payload must be valid JSON"] }) }
        }
        function removeKit(value: string): string {
            return JSON.stringify({ ok: root.departuresService ? root.departuresService.removeKit(value) : false })
        }
        function configure(payloadJson: string): string {
            if (!root.departuresService) return JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
            try { return root.departuresService.resultJson(root.departuresService.updateSettings(JSON.parse(payloadJson || "{}"))) }
            catch (error) { return root.departuresService.resultJson({ ok: false, errors: ["Payload must be valid JSON"] }) }
        }
        function capabilities(): string {
            return JSON.stringify(root.departuresService ? root.departuresService.capabilities : {})
        }
        function location(coordinates: string, label: string): string {
            return root.departuresService ? root.departuresService.resultJson(root.departuresService.setCurrentLocation(coordinates, label))
                : JSON.stringify({ ok: false, errors: ["Departures service is unavailable"] })
        }
        function resetLearning(): string {
            return JSON.stringify({ ok: root.departuresService ? root.departuresService.resetLearning() : false })
        }
    }

    WidgetButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: root.vertical ? "󰁕" : (root.departuresService ? root.departuresService.barText : "󰁕  Departures")
        active: root.departuresService && root.departuresService.nextDeparture
            ? ["LEAVE SOON", "LEAVE NOW"].indexOf(root.departuresService.nextDeparture.status) !== -1
            : false
        tooltipText: root.departuresService ? root.departuresService.nextAction : "Departures"
        horizontalMargin: 8
        onPressed: root.toggle()
    }
}
