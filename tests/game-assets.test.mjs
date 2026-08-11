import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOWER_ASSETS,
  GAME_ASSETS,
  getPeanutAsset,
} from "../app/game-assets.ts";

test("formal flower assets map every internal color in one place", () => {
  assert.deepEqual(FLOWER_ASSETS, {
    yellow: "/flower_y.webp",
    pink: "/flower_r.webp",
    blue: "/flower_b.webp",
    purple: "/flower_v.webp",
  });
});

test("formal field, peanut, and mascot assets use their public paths", () => {
  assert.equal(GAME_ASSETS.peanut.normal, "/peanut_normal.webp");
  assert.equal(GAME_ASSETS.peanut.happy, "/peanut_happy.webp");
  assert.equal(GAME_ASSETS.background, "/background.png");
  assert.equal(GAME_ASSETS.title, "/title.png");
  assert.equal(GAME_ASSETS.leafBorder, "/leaf-border.webp");
  assert.equal(GAME_ASSETS.mascot, "/peanutboy.png");
  assert.equal(getPeanutAsset(false), "/peanut_normal.webp");
  assert.equal(getPeanutAsset(true), "/peanut_happy.webp");
});
