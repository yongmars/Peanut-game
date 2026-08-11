import assert from "node:assert/strict";
import test from "node:test";
import { getTouchGesture, TOUCH_SWIPE_THRESHOLD } from "../app/touch-controls.ts";

test("short touch movement remains a tap that rotates", () => {
  assert.equal(getTouchGesture(0, 0), "rotate");
  assert.equal(getTouchGesture(TOUCH_SWIPE_THRESHOLD - 1, 0), "rotate");
});

test("horizontal swipes move one column in their dominant direction", () => {
  assert.equal(getTouchGesture(-TOUCH_SWIPE_THRESHOLD, 4), "move-left");
  assert.equal(getTouchGesture(TOUCH_SWIPE_THRESHOLD, -4), "move-right");
});

test("down swipe hard-drops and up swipe does not become a tap", () => {
  assert.equal(getTouchGesture(3, TOUCH_SWIPE_THRESHOLD), "hard-drop");
  assert.equal(getTouchGesture(0, -TOUCH_SWIPE_THRESHOLD), null);
});
