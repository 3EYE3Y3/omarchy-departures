import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = name => fs.readFileSync(path.join(root, name), "utf8")
const panel = read("Panel.qml")
const card = read("DepartureCard.qml")
const details = read("DepartureDetails.qml")
const editor = read("DepartureEditor.qml")
const service = read("Service.qml")

test("primary Add and first-run action open a fresh editor", () => {
  assert.match(card, /text: "\+  ADD"[\s\S]*onClicked: card\.addRequested\(\)/)
  assert.match(panel, /"ADD YOUR FIRST DEPARTURE"[\s\S]*onClicked: root\.beginCreate\(\)/)
  assert.match(panel, /function beginCreate\(\)[\s\S]*editor\.openFor\(null\)/)
  assert.doesNotMatch(panel, /text: "ADD"[^\n]*onClicked: root\.createNatural\(\)/)
})

test("first run explains the product in one glance", () => {
  assert.match(panel, /Know when to get ready and when to leave\./)
  assert.match(panel, /No departures yet/)
  assert.match(panel, /Add somewhere you need to be/)
  assert.match(panel, /No upcoming departures/)
  assert.match(panel, /Your previous departures have passed/)
})

test("editor uses plain timing language and hides advanced concepts by default", () => {
  assert.match(editor, /value: "auto", label: "AUTOMATIC"/)
  assert.match(editor, /value: "manual", label: "FIXED TIME"/)
  assert.match(editor, /property bool advancedOpen: false/)
  assert.match(editor, /visible: editor\.advancedOpen/)
  assert.match(editor, /visible: editor\.timingMode === "manual"/)
  assert.match(editor, /Where are you going\?/)
  assert.match(editor, /When do you need to be there\?/)
  assert.match(editor, /Where are you leaving from\?/)
  assert.match(editor, /Date\.now\(\) \+ 90 \* Timing\.MINUTE_MS/)
  assert.match(editor, /defaults \? defaults\.arrivalBufferMinutes : 5/)
  assert.match(editor, /defaults \? defaults\.preparationMinutes : 15/)
})

test("opening Add resets state and destination can supply the optional name", () => {
  for (const reset of ["titleField.text", "destinationField.text", "originField.text", "reminderItems", "notesField.text", "timingMode", "advancedOpen"])
    assert.match(editor, new RegExp(reset.replace(".", "\\.")))
  assert.match(editor, /title: title \|\| destination/)
  assert.match(panel, /var result = departuresService\.saveDeparture\(draft, editingId\)/)
  assert.match(panel, /if \(!result\.ok\)[\s\S]*editor\.errorText = result\.errors\.join/)
})

test("cancel returns to the board without saving and delete remains confirmed", () => {
  assert.match(panel, /onCancelRequested: root\.leaveSubview\(\)/)
  assert.match(panel, /function leaveSubview\(\)[\s\S]*view = "board"/)
  assert.match(panel, /if \(pendingDeleteId === id\)[\s\S]*deleteDeparture\(id\)/)
  assert.match(panel, /Press Delete again to confirm/)
})

test("primary card contains the human UX contract without provider noise", () => {
  assert.match(card, /NEXT DEPARTURE/)
  assert.match(card, /Timing\.nextAction/)
  assert.match(card, /Leave by/)
  assert.match(card, /Travel time/)
  assert.match(card, /Presentation\.travelLine/)
  assert.match(card, /Presentation\.arrivalLabel/)
  assert.doesNotMatch(card, /OSRM|OpenStreetMap|Traffic:|routeError|routeProvider|providerMessage|capabilityLine/)
  assert.doesNotMatch(panel, /OSRM|OpenStreetMap|Traffic:|providerMessage|capabilityLine/)
  assert.doesNotMatch(card, /timingMode|autoTravelMinutes|manualTravelMinutes|routeStatus|revision|cache/i)
})

test("reliable fallback is not red while unusable timing is blocking", () => {
  assert.match(card, /timingImpact\.level === "blocking"[\s\S]*Color\.urgent/)
  assert.doesNotMatch(card, /routeStatus[\s\S]*Color\.urgent/)
  assert.match(details, /timingImpact\.level === "blocking"[\s\S]*Color\.urgent/)
})

test("routing diagnostics and recovery actions are available only in details", () => {
  assert.match(details, /ROUTING DETAILS/)
  assert.match(details, /Technical detail:/)
  assert.match(details, /Provider:/)
  assert.match(details, /text: "RETRY"/)
  assert.match(details, /text: "EDIT LOCATIONS"/)
  assert.match(details, /retryRoute/)
  assert.match(details, /TURN OFF ROUTING/)
})

test("long destination labels remain bounded and readable", () => {
  assert.match(card, /wrapMode: Text\.Wrap/)
  assert.match(card, /maximumLineCount: 2/)
  assert.match(card, /elide: Text\.ElideRight/)
  assert.match(details, /maximumLineCount: 3/)
})

test("service gates queued, in-flight, and applied route work by automatic mode", () => {
  const gates = service.match(/!Routing\.isAutomaticTiming\(departure\)/g) || []
  assert.ok(gates.length >= 4)
})
