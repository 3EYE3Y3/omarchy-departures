import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = name => fs.readFileSync(path.join(root, name), "utf8")
const panel = read("Panel.qml")
const row = read("DepartureBoardRow.qml")
const details = read("DepartureDetails.qml")
const editor = read("DepartureEditor.qml")
const service = read("Service.qml")
const presentation = read("js/presentation.js")

test("primary Add and first-run action open a fresh editor", () => {
  assert.match(panel, /text: "\+  ADD"[\s\S]*onClicked: root\.beginCreate\(\)/)
  assert.match(panel, /"ADD YOUR FIRST DEPARTURE"[\s\S]*onClicked: root\.beginCreate\(\)/)
  assert.match(panel, /function beginCreate\(\)[\s\S]*editor\.openFor\(null\)/)
})

test("first run waits for hydration and explains the product in one glance", () => {
  assert.match(panel, /visible: !root\.hydrated/)
  assert.match(panel, /Loading departures…/)
  assert.match(panel, /root\.hydrated && root\.boardCount === 0/)
  assert.match(panel, /Know when to get ready and when to leave\./)
  assert.match(panel, /No departures yet/)
  assert.match(panel, /No upcoming departures/)
})

test("editor keeps Automatic and Fixed time mutually exclusive with simple defaults", () => {
  assert.match(editor, /value: "auto", label: "AUTOMATIC"/)
  assert.match(editor, /value: "manual", label: "FIXED TIME"/)
  assert.match(editor, /property bool advancedOpen: false/)
  assert.match(editor, /visible: editor\.advancedOpen/)
  assert.match(editor, /visible: editor\.timingMode === "manual"/)
  assert.match(editor, /Where are you going\?/)
  assert.match(editor, /When do you need to be there\?/)
  assert.match(editor, /Where are you leaving from\?/)
  assert.match(editor, /Date\.now\(\) \+ 90 \* Timing\.MINUTE_MS/)
})

test("opening Add resets state and destination supplies the optional name", () => {
  for (const reset of ["titleField.text", "destinationField.text", "originField.text", "reminderItems", "notesField.text", "timingMode", "advancedOpen"])
    assert.match(editor, new RegExp(reset.replace(".", "\\.")))
  assert.match(editor, /title: title \|\| destination/)
  assert.match(panel, /departuresService\.saveDeparture\(draft, editingId\)/)
})

test("main view is one airport-style board model with the required row hierarchy", () => {
  assert.match(panel, /ListView \{[\s\S]*model: root\.departuresService \? root\.departuresService\.boardModel/)
  assert.match(panel, /delegate: DepartureBoardRow/)
  for (const heading of ["ARRIVE", "DESTINATION", "LEAVE", "STATUS"]) assert.match(panel, new RegExp(`text: "${heading}"`))
  assert.match(row, /text: row\.leaveText[\s\S]*font\.pixelSize: Style\.font\.display/)
  assert.match(row, /text: row\.destination\.toUpperCase\(\)/)
  assert.match(row, /text: row\.statusText/)
  assert.match(row, /row\.dayHeading/)
  assert.match(panel, /root\.departuresService\.nextAction\.toUpperCase\(\)/)
})

test("board model is reconciled in place instead of rebuilding delegates", () => {
  assert.match(service, /Board\.syncModel\(departureBoardModel, Board\.rows/)
  assert.doesNotMatch(service, /departureBoardModel\.clear\(/)
  assert.doesNotMatch(panel, /Repeater[\s\S]*root\.upcoming\.slice/)
  assert.match(panel, /reuseItems: true/)
  assert.match(panel, /savedBoardContentY = boardList\.contentY/)
  assert.match(panel, /boardList\.contentY = Math\.max/)
})

test("hydration is one-shot and cannot repeatedly reset the board", () => {
  assert.match(service, /function restore\(raw\) \{[\s\S]*if \(hydrated\) return/)
  assert.match(service, /hydrated = true[\s\S]*refresh\(Date\.now\(\)\)/)
  assert.doesNotMatch(service, /hydrated = false/)
})

test("row selection opens details and returning preserves the board surface", () => {
  assert.match(row, /signal activated\(string departureId\)/)
  assert.match(panel, /onActivated: function\(departureId\) \{ root\.beginDetailsById\(departureId\) \}/)
  assert.match(panel, /function leaveSubview\(\)[\s\S]*view = "board"/)
  assert.match(panel, /onBackRequested: root\.leaveSubview\(\)/)
})

test("primary board contains no raw provider diagnostics", () => {
  const primary = panel + row
  assert.doesNotMatch(primary, /OSRM|OpenStreetMap|Traffic:|routeError|routeProvider|providerMessage|capabilityLine|Technical detail:/)
  assert.match(row, /Presentation\.compactTimingLine/)
  assert.match(presentation, /Automatic · saved/)
  assert.match(row, /ROUTE NEEDED/)
})

test("Automatic details provide safe manual refresh and technical disclosure", () => {
  assert.match(details, /text: "REFRESH NOW"/)
  assert.match(details, /retryRoute/)
  assert.match(details, /ADVANCED \/ TECHNICAL/)
  assert.match(details, /Technical detail:/)
  assert.match(details, /Provider:/)
  assert.match(details, /text: "EDIT LOCATIONS"/)
})

test("automatic create, edit, activation, and location saves share the immediate provider path", () => {
  assert.match(service, /Qt\.callLater\(function\(\) \{ service\.prepareNetworkFor\(result\.value\.id, true\) \}\)/)
  assert.match(service, /if \(cached && !immediate\)/)
  assert.match(service, /prepareNetworkFor\(copy\.id, true\)/)
  assert.match(service, /function retryRoute[\s\S]*prepareNetworkFor\(id, true\)/)
})

test("one central scheduler covers all upcoming Automatic departures", () => {
  assert.match(service, /Timer \{[\s\S]*interval: 15000[\s\S]*service\.refresh\(Date\.now\(\)\)/)
  assert.match(service, /function maybeRefreshRoutes\(now\)[\s\S]*var source = upcoming\.slice\(\)/)
  assert.match(service, /Routing\.nextRefreshAt\(source\[i\], now, provider\)/)
  assert.doesNotMatch(service, /upcoming\.slice\(0,\s*3\)/)
  assert.doesNotMatch(row + details, /Timer \{/)
})

test("manual route results remain gated and cannot change fixed timing", () => {
  const gates = service.match(/!Routing\.isAutomaticTiming\(departure\)/g) || []
  assert.ok(gates.length >= 4)
  assert.match(service, /if \(result\.value\.timingMode === "manual"\) discardQueuedNetworkFor/)
})

test("long destination labels are bounded without widening a row", () => {
  assert.match(row, /Layout\.fillWidth: true[\s\S]*text: row\.destination\.toUpperCase\(\)[\s\S]*elide: Text\.ElideRight/)
  assert.match(details, /maximumLineCount: 3/)
})

test("cancel and two-step delete remain intact", () => {
  assert.match(panel, /onCancelRequested: root\.leaveSubview\(\)/)
  assert.match(panel, /if \(pendingDeleteId === id\)[\s\S]*deleteDeparture\(id\)/)
  assert.match(panel, /Press Delete again to confirm/)
})
