import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const publicFiles = [
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "README.md",
  "bin/departures",
  "DepartureEditor.qml",
  "Panel.qml",
  ...fs.readdirSync(path.join(root, "docs")).map(name => `docs/${name}`),
  ...fs.readdirSync(path.join(root, "tests"))
    .filter(name => name.endsWith(".mjs") && name !== "privacy.test.mjs")
    .map(name => `tests/${name}`),
]

test("public surfaces contain the permanent fictional-data privacy policy and no known legacy location leaks", () => {
  const policy = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")
  assert.match(policy, /Never use a user's persisted Departures state/)
  assert.match(policy, /fictional generic information/)

  const corpus = publicFiles.map(name => fs.readFileSync(path.join(root, name), "utf8")).join("\n")
  const knownLegacyLeaks = [
    ["Frem", "antle"].join(""),
    ["Cock", "burn Ice Arena"].join(""),
    ["Revo", " Fitness"].join(""),
  ]
  for (const value of knownLegacyLeaks) assert.doesNotMatch(corpus, new RegExp(value, "i"))
})
