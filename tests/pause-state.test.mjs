import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoPause } from "../app/pause-state.ts";

test("only a hidden playing page auto-pauses", () => {
  assert.equal(shouldAutoPause("playing", "hidden"), true);
  assert.equal(shouldAutoPause("playing", "visible"), false);
  assert.equal(shouldAutoPause("paused", "hidden"), false);
  assert.equal(shouldAutoPause("title", "hidden"), false);
  assert.equal(shouldAutoPause("tutorial", "hidden"), false);
  assert.equal(shouldAutoPause("gameOver", "hidden"), false);
});
