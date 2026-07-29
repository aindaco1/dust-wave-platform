import assert from "node:assert/strict";
import test from "node:test";

import {
  mountUnsavedChangesGuard
} from "../src/unsaved-changes.js";

function eventTargetFixture() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event) {
      listeners.get(type)?.(event);
    },
    has(type) {
      return listeners.has(type);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    }
  };
}

function beforeUnloadEvent() {
  return {
    defaultPrevented: false,
    returnValue: undefined,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

test("blocks browser exit only while the consumer reports unsaved changes", () => {
  const eventTarget = eventTargetFixture();
  let dirty = false;
  const guard = mountUnsavedChangesGuard({
    eventTarget,
    hasUnsavedChanges: () => dirty
  });

  const cleanEvent = beforeUnloadEvent();
  eventTarget.dispatch("beforeunload", cleanEvent);
  assert.equal(cleanEvent.defaultPrevented, false);
  assert.equal(cleanEvent.returnValue, undefined);

  dirty = true;
  const dirtyEvent = beforeUnloadEvent();
  eventTarget.dispatch("beforeunload", dirtyEvent);
  assert.equal(dirtyEvent.defaultPrevented, true);
  assert.equal(dirtyEvent.returnValue, "");
  assert.equal(guard.hasUnsavedChanges(), true);
});

test("asks the injected confirmer for dirty in-app transitions", () => {
  const messages = [];
  let dirty = true;
  const guard = mountUnsavedChangesGuard({
    eventTarget: eventTargetFixture(),
    hasUnsavedChanges: () => dirty,
    confirmDiscard(message) {
      messages.push(message);
      return messages.length > 1;
    }
  });

  assert.equal(guard.confirmTransition("Discard the draft?"), false);
  assert.equal(guard.confirmTransition("Discard the draft?"), true);
  assert.equal(
    guard.confirmTransition("Chapter is clean", () => false),
    true
  );
  dirty = false;
  assert.equal(guard.confirmTransition("Unused"), true);
  assert.deepEqual(messages, ["Discard the draft?", "Discard the draft?"]);
});

test("fails closed when dirty-state or confirmation adapters throw", () => {
  const eventTarget = eventTargetFixture();
  const guard = mountUnsavedChangesGuard({
    eventTarget,
    hasUnsavedChanges() {
      throw new Error("adapter unavailable");
    },
    confirmDiscard() {
      throw new Error("dialog unavailable");
    }
  });

  const event = beforeUnloadEvent();
  eventTarget.dispatch("beforeunload", event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(guard.hasUnsavedChanges(), true);
  assert.equal(guard.confirmTransition("Discard?"), false);
});

test("disconnect removes the lifecycle listener idempotently", () => {
  const eventTarget = eventTargetFixture();
  const guard = mountUnsavedChangesGuard({
    eventTarget,
    hasUnsavedChanges: () => true
  });

  assert.equal(eventTarget.has("beforeunload"), true);
  guard.disconnect();
  guard.disconnect();
  assert.equal(eventTarget.has("beforeunload"), false);
});
