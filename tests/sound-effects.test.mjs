import assert from "node:assert/strict";
import test from "node:test";
import {
  createSoundEffectPlayer,
  getChainSoundEffect,
  SOUND_EFFECTS,
} from "../app/sound-effects.ts";

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.preload = "";
    this.volume = 1;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  pause() {
    this.pauseCalls += 1;
  }

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }
}

test("all requested sound effects keep their paths, volumes and scopes together", () => {
  assert.deepEqual(SOUND_EFFECTS, {
    flowerLand: { src: "/music/sound effects/flower_land_pofu.wav", volume: 0.75, scope: "gameplay" },
    rotate: { src: "/music/sound effects/rotate_kuru.wav", volume: 0.7, scope: "gameplay" },
    flowerClear: { src: "/music/sound effects/flower_clear_kiran.wav", volume: 0.65, scope: "gameplay" },
    gynophore: { src: "/music/sound effects/gynophore_nyuu.wav", volume: 0.55, scope: "gameplay" },
    peanutPop: { src: "/music/sound effects/peanut_pop_poko.wav", volume: 0.5, scope: "gameplay", minIntervalMs: 100 },
    harvest: { src: "/music/sound effects/harvest_supon.wav", volume: 0.6, scope: "gameplay" },
    chain1: { src: "/music/sound effects/chain_1.wav", volume: 0.6, scope: "gameplay" },
    chain2: { src: "/music/sound effects/chain_2.wav", volume: 0.6, scope: "gameplay" },
    chain3: { src: "/music/sound effects/chain_3.wav", volume: 0.6, scope: "gameplay" },
    chain4: { src: "/music/sound effects/chain_4.wav", volume: 0.6, scope: "gameplay" },
    chain5: { src: "/music/sound effects/chain_5.wav", volume: 0.6, scope: "gameplay" },
    levelUp: { src: "/music/sound effects/level_up.wav", volume: 0.65, scope: "gameplay" },
    pauseClick: { src: "/music/sound effects/pause_click.wav", volume: 0.75, scope: "ui" },
    gameOver: { src: "/music/sound effects/game_over_pororon.wav", volume: 0.75, scope: "gameplay" },
  });
});

test("chain sound selection caps every chain from five onward", () => {
  assert.equal(getChainSoundEffect(1), "chain1");
  assert.equal(getChainSoundEffect(2), "chain2");
  assert.equal(getChainSoundEffect(3), "chain3");
  assert.equal(getChainSoundEffect(4), "chain4");
  assert.equal(getChainSoundEffect(5), "chain5");
  assert.equal(getChainSoundEffect(8), "chain5");
});

test("different effects can overlap and receive their configured volumes", () => {
  const audios = [];
  const player = createSoundEffectPlayer((src) => {
    const audio = new FakeAudio(src);
    audios.push(audio);
    return audio;
  });

  assert.equal(player.playSound("flowerClear"), true);
  assert.equal(player.playSound("chain2"), true);
  assert.equal(audios.length, 2);
  assert.equal(audios[0].playCalls, 1);
  assert.equal(audios[0].volume, 0.65);
  assert.equal(audios[1].playCalls, 1);
  assert.equal(audios[1].volume, 0.6);
});

test("peanut pop sounds are separated while later animation waves still play", () => {
  let now = 1_000;
  const audios = [];
  const player = createSoundEffectPlayer((src) => {
    const audio = new FakeAudio(src);
    audios.push(audio);
    return audio;
  }, () => now);

  assert.equal(player.playSound("peanutPop"), true);
  now += 99;
  assert.equal(player.playSound("peanutPop"), false);
  now += 41;
  assert.equal(player.playSound("peanutPop"), true);
  assert.equal(audios.length, 2);
});

test("pausing stops gameplay effects without cutting off the UI click", () => {
  const audios = [];
  const player = createSoundEffectPlayer((src) => {
    const audio = new FakeAudio(src);
    audios.push(audio);
    return audio;
  });

  player.playSound("gynophore");
  player.playSound("pauseClick");
  player.stopGameplaySounds();

  assert.equal(audios[0].pauseCalls, 1);
  assert.equal(audios[1].pauseCalls, 0);
  player.stopAllSounds();
  assert.equal(audios[1].pauseCalls, 1);
});
