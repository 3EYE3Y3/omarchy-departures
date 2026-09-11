import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Notifications = loadQmlJs(new URL("../js/notification_state.js", import.meta.url))
const Timing = loadQmlJs(new URL("../js/timing.js", import.meta.url))

const eventTime = new Date(2026, 8, 11, 18, 30).getTime()
const departure = {
  id: "dep-1",
  revision: 1,
  title: "Dinner",
  arrivalTime: eventTime,
  travelMinutes: 20,
  arrivalBufferMinutes: 10,
  preparationMinutes: 30,
}
const times = Timing.derive(departure)

test("fires get-ready once and persists its deduplication key", () => {
  let sent = {}
  const due = Notifications.dueEvents(departure, times.getReadyTime, sent, times)
  assert.deepEqual(Array.from(due, event => event.kind), ["ready"])
  sent = Notifications.mark(sent, due[0], times.getReadyTime)
  assert.equal(Notifications.dueEvents(departure, times.getReadyTime + 1, sent, times).length, 0)
})

test("reload between get-ready and leave does not duplicate", () => {
  const key = Notifications.keyFor(departure, "ready")
  const reloaded = { [key]: times.getReadyTime }
  assert.equal(Notifications.dueEvents(departure, times.leaveTime - 1, reloaded, times).length, 0)
})

test("reload after leave emits only leave-now, then deduplicates it", () => {
  let sent = {}
  let due = Notifications.dueEvents(departure, times.leaveTime, sent, times)
  assert.deepEqual(Array.from(due, event => event.kind), ["leave"])
  sent = Notifications.mark(sent, due[0], times.leaveTime)
  due = Notifications.dueEvents(departure, times.leaveTime + 1, sent, times)
  assert.equal(due.length, 0)
})

test("does not catch up obsolete notifications after expiry", () => {
  assert.equal(Notifications.dueEvents(departure, times.eventTime + 1, {}, times).length, 0)
})

test("editing gets a fresh revision namespace and pruning removes old keys", () => {
  const sent = { [Notifications.keyFor(departure, "ready")]: times.getReadyTime }
  const edited = { ...departure, revision: 2 }
  assert.equal(Object.keys(Notifications.prune(sent, [edited])).length, 0)
  assert.equal(Notifications.dueEvents(edited, times.getReadyTime, sent, times).length, 1)
})

test("deletion prunes all notification state", () => {
  const sent = { [Notifications.keyFor(departure, "ready")]: times.getReadyTime }
  assert.deepEqual(Object.keys(Notifications.prune(sent, [])), [])
})
