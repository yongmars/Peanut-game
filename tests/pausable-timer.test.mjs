import assert from "node:assert/strict";
import test from "node:test";
import { getRemainingTime } from "../app/use-pausable-timer.ts";

test("pausable timers preserve only the unelapsed duration", () => {
  assert.equal(getRemainingTime(900, 1_000, 1_250), 650);
  assert.equal(getRemainingTime(520, 2_000, 2_600), 0);
  assert.equal(getRemainingTime(450, 3_000, 2_900), 450);
});
