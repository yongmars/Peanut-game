import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTutorialSeen,
  TUTORIAL_STORAGE_KEY,
} from "../app/tutorial.ts";

test("tutorial completion uses a stable localStorage key", () => {
  assert.equal(TUTORIAL_STORAGE_KEY, "rakkasei-tutorial-seen");
});

test("only an explicit true marks the tutorial as seen", () => {
  assert.equal(parseTutorialSeen(null), false);
  assert.equal(parseTutorialSeen(""), false);
  assert.equal(parseTutorialSeen("false"), false);
  assert.equal(parseTutorialSeen("invalid"), false);
  assert.equal(parseTutorialSeen("true"), true);
});
