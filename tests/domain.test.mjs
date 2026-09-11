import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Domain = loadQmlJs(new URL("../js/domain.js", import.meta.url))

const now = new Date(2026, 8, 11, 12).getTime()
const input = {
  title: "School pickup",
  destination: "School",
  arrivalTime: now + 3600000,
  travelMinutes: 15,
  arrivalBufferMinutes: 5,
  preparationMinutes: 20,
  transportMode: "drive",
  profile: "school",
  reminders: ["Keys", "Water", "keys"],
  notes: "Front gate",
}

test("creates, normalizes, and deduplicates a departure", () => {
  const result = Domain.create(input, now, "dep-1")
  assert.equal(result.ok, true)
  assert.equal(result.value.id, "dep-1")
  assert.equal(result.value.revision, 1)
  assert.deepEqual(Array.from(result.value.reminders), ["Keys", "Water"])
})

test("rejects invalid and past records", () => {
  assert.equal(Domain.create({ ...input, title: "" }, now, "bad").ok, false)
  assert.equal(Domain.create({ ...input, destination: "" }, now, "bad").ok, false)
  assert.equal(Domain.create({ ...input, arrivalTime: now - 1 }, now, "bad").ok, false)
  assert.equal(Domain.create({ ...input, travelMinutes: -1 }, now, "bad").ok, false)
})

test("editing recalculates data and advances notification revision", () => {
  const original = Domain.create(input, now, "dep-1").value
  const changed = Domain.edit(original, { ...input, arrivalTime: input.arrivalTime + 1800000, travelMinutes: 30 }, now + 1000)
  assert.equal(changed.ok, true)
  assert.equal(changed.value.arrivalTime, input.arrivalTime + 1800000)
  assert.equal(changed.value.travelMinutes, 30)
  assert.equal(changed.value.revision, 2)
  assert.equal(changed.value.createdAt, original.createdAt)
})

test("upsert sorts records and deletion removes only the target", () => {
  const first = Domain.create(input, now, "first").value
  const second = Domain.create({ ...input, arrivalTime: input.arrivalTime + 60000 }, now, "second").value
  const records = Domain.upsert(Domain.upsert([], second), first)
  assert.deepEqual(Array.from(records, item => item.id), ["first", "second"])
  assert.deepEqual(Array.from(Domain.remove(records, "first"), item => item.id), ["second"])
})

test("restores expired records without treating them as invalid", () => {
  const record = Domain.create(input, now, "dep-1").value
  record.arrivalTime = now - 86400000
  assert.equal(Domain.restore(record).id, "dep-1")
})

test("restores a v0.1 record with zero-valued v0.2 logistics defaults", () => {
  const legacy = Domain.create(input, now, "legacy").value
  delete legacy.parkingMinutes
  delete legacy.walkingMinutes
  delete legacy.origin
  const restored = Domain.restore(legacy)
  assert.equal(restored.id, "legacy")
  assert.equal(restored.parkingMinutes, 0)
  assert.equal(restored.walkingMinutes, 0)
  assert.equal(restored.origin, "")
})
