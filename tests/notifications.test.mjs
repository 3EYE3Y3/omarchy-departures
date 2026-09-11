import assert from "node:assert/strict"
import test from "node:test"
import { loadQmlJs } from "./load-qml-js.mjs"

const Notifications = loadQmlJs(new URL("../js/notification_state.js", import.meta.url))
const Timing = loadQmlJs(new URL("../js/timing.js", import.meta.url))

const eventTime = new Date(2026, 8, 11, 18, 30).getTime()
const departure = {
  id: "dep-1",
  revision: 1,
  title: "Morning meeting",
  arrivalTime: eventTime,
  timingMode: "auto",
  manualTravelMinutes: 20,
  autoTravelMinutes: 20,
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

test("dynamic travel adjustment does not duplicate a sent boundary", () => {
  const sent = Notifications.mark({}, { key: Notifications.keyFor(departure, "ready") }, times.getReadyTime)
  const trafficChanged = { ...departure, autoTravelMinutes: 43 }
  const changedTimes = Timing.derive(trafficChanged)
  assert.equal(Notifications.dueEvents(trafficChanged, changedTimes.getReadyTime, sent, changedTimes).length, 0)
  const atLeave = Notifications.dueEvents(trafficChanged, changedTimes.leaveTime, sent, changedTimes)
  assert.deepEqual(Array.from(atLeave, event => event.kind), ["leave"])
})

test("manual provider observations do not change notification timing or revision keys", () => {
  const manual = { ...departure, timingMode: "manual", manualTravelMinutes: 25, autoTravelMinutes: 20 }
  const before = Timing.derive(manual)
  const providerObserved = { ...manual, autoTravelMinutes: 50 }
  const after = Timing.derive(providerObserved)
  assert.equal(after.leaveTime, before.leaveTime)
  assert.equal(Notifications.keyFor(providerObserved, "ready"), Notifications.keyFor(manual, "ready"))
  const sent = Notifications.mark({}, { key: Notifications.keyFor(manual, "ready") }, before.getReadyTime)
  assert.equal(Notifications.dueEvents(providerObserved, after.getReadyTime, sent, after).length, 0)
})
