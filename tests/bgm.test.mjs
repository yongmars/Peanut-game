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
    normal: "/music/peanutgame_music.mp3",
    rapid: "/music/peanutgame_musicrapid.mp3",
  });
  assert.deepEqual(BGM_SETTINGS, {
    switchLevel: 3,
    volume: 0.35,
    fadeMs: 250,
    storageKey: "rakkasei-bgm-enabled",
  });
});

test("LEVEL 1 and 2 use normal BGM, LEVEL 3 and above use rapid BGM", () => {
  assert.equal(getBgmTrackForLevel(1), "normal");
  assert.equal(getBgmTrackForLevel(2), "normal");
  assert.equal(getBgmTrackForLevel(3), "rapid");
  assert.equal(getBgmTrackForLevel(4), "rapid");
  assert.equal(getBgmTrackForLevel(5), "rapid");
});

test("BGM defaults to enabled and only an explicit false disables it", () => {
  assert.equal(parseBgmEnabled(null), true);
  assert.equal(parseBgmEnabled("true"), true);
  assert.equal(parseBgmEnabled("false"), false);
  assert.equal(parseBgmEnabled("invalid"), true);
});
