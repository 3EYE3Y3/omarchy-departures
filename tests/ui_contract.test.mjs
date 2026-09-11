import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const panel = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")
const editor = fs.readFileSync(path.join(root, "DepartureEditor.qml"), "utf8")
const service = fs.readFileSync(path.join(root, "Service.qml"), "utf8")

test("primary Add opens a fresh editor instead of submitting an empty quick-create", () => {
  assert.match(panel, /Button \{ text: "\+  ADD";[^\n]+onClicked: root\.beginCreate\(\)/)
  assert.doesNotMatch(panel, /Button \{ text: "ADD";[^\n]+onClicked: root\.createNatural\(\)/)
  assert.match(panel, /function beginCreate\(\)[\s\S]*editor\.openFor\(null\)/)
})

test("editor exposes one segmented timing mode and deactivates manual input in auto", () => {
  assert.match(editor, /ButtonGroup[\s\S]*value: editor\.timingMode/)
  assert.match(editor, /value: "auto", label: "AUTO"/)
  assert.match(editor, /value: "manual", label: "MANUAL"/)
  assert.match(editor, /enabled: editor\.timingMode === "manual"/)
})

test("opening Add resets form state and save uses validated service creation", () => {
  for (const reset of ["titleField.text", "destinationField.text", "originField.text", "reminderItems", "notesField.text", "timingMode"])
    assert.match(editor, new RegExp(reset.replace(".", "\\.")))
  assert.match(panel, /var result = departuresService\.saveDeparture\(draft, editingId\)/)
  assert.match(panel, /if \(!result\.ok\)[\s\S]*editor\.errorText = result\.errors\.join/)
})

test("cancel returns to the board without saving and delete remains confirmed", () => {
  assert.match(panel, /onCancelRequested: root\.leaveEditor\(\)/)
  assert.match(panel, /function leaveEditor\(\)[\s\S]*view = "board"/)
  assert.match(panel, /if \(pendingDeleteId === String\(id\)\)[\s\S]*deleteDeparture\(id\)/)
})

test("service gates queued, in-flight, and applied route work by automatic mode", () => {
  const gates = service.match(/!Routing\.isAutomaticTiming\(departure\)/g) || []
  assert.ok(gates.length >= 4)
})
