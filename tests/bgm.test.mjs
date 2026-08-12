import assert from "node:assert/strict";
import test from "node:test";
import {
  BGM_ASSETS,
  BGM_SETTINGS,
  getBgmTrackForLevel,
  parseBgmEnabled,
} from "../app/bgm.ts";

test("BGM settings keep paths, switch level, volume, fade and storage key together", () => {
  assert.deepEqual(BGM_ASSETS, {
    farm: "/music/rakkasei_bgm_farmcute.mp3",
    advanced: "/music/rakkasei_bgm.mp3",
  });
  assert.deepEqual(BGM_SETTINGS, {
    switchLevel: 4,
    volume: 0.35,
    fadeMs: 750,
    storageKey: "rakkasei-bgm-enabled",
  });
});

test("LEVEL 1 through 3 use farm BGM and LEVEL 4 onward uses advanced BGM", () => {
  assert.equal(getBgmTrackForLevel(1), "farm");
  assert.equal(getBgmTrackForLevel(2), "farm");
  assert.equal(getBgmTrackForLevel(3), "farm");
  assert.equal(getBgmTrackForLevel(4), "advanced");
  assert.equal(getBgmTrackForLevel(5), "advanced");
});

test("BGM defaults to enabled and only an explicit false disables it", () => {
  assert.equal(parseBgmEnabled(null), true);
  assert.equal(parseBgmEnabled("true"), true);
  assert.equal(parseBgmEnabled("false"), false);
  assert.equal(parseBgmEnabled("invalid"), true);
});
