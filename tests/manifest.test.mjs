import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))

test("manifest declares the supported Omarchy v1 service and bar contracts", () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.id, "io.github.3eye3y3.departures")
  assert.equal(manifest.version, "0.2.0")
  assert.deepEqual(manifest.kinds, ["service", "bar-widget"])
  assert.equal(manifest.barWidget.allowMultiple, false)
  assert.equal(manifest.barWidget.defaultSection, "center")
})

test("every entry point is safe, relative, and present", () => {
  for (const entry of Object.values(manifest.entryPoints)) {
    assert.equal(path.isAbsolute(entry), false)
    assert.equal(entry.includes(".."), false)
    assert.equal(fs.statSync(path.join(root, entry)).isFile(), true)
  }
})

test("manifest contains no private Omarchy metadata", () => {
  assert.equal(JSON.stringify(manifest).includes("__sourceDir"), false)
  assert.equal(Object.keys(manifest).some(key => key.startsWith("__")), false)
})
