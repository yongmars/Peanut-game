export type SoundEffectScope = "gameplay" | "ui";

export const SOUND_EFFECTS = {
  flowerLand: {
    src: "/music/sound effects/flower_land_pofu.wav",
    volume: 0.75,
    scope: "gameplay",
  },
  rotate: {
    src: "/music/sound effects/rotate_kuru.wav",
    volume: 0.7,
    scope: "gameplay",
  },
  flowerClear: {
    src: "/music/sound effects/flower_clear_kiran.wav",
    volume: 0.65,
    scope: "gameplay",
  },
  gynophore: {
    src: "/music/sound effects/gynophore_nyuu.wav",
    volume: 0.55,
    scope: "gameplay",
  },
  peanutPop: {
    src: "/music/sound effects/peanut_pop_poko.wav",
    volume: 0.5,
    scope: "gameplay",
    minIntervalMs: 100,
  },
  harvest: {
    src: "/music/sound effects/harvest_supon.wav",
    volume: 0.6,
    scope: "gameplay",
  },
  chain1: {
    src: "/music/sound effects/chain_1.wav",
    volume: 0.6,
    scope: "gameplay",
  },
  chain2: {
    src: "/music/sound effects/chain_2.wav",
    volume: 0.6,
    scope: "gameplay",
  },
  chain3: {
    src: "/music/sound effects/chain_3.wav",
    volume: 0.6,
    scope: "gameplay",
  },
  chain4: {
    src: "/music/sound effects/chain_4.wav",
    volume: 0.6,
    scope: "gameplay",
  },
  chain5: {
    src: "/music/sound effects/chain_5.wav",
    volume: 0.6,
    scope: "gameplay",
  },
  levelUp: {
    src: "/music/sound effects/level_up.wav",
    volume: 0.65,
    scope: "gameplay",
  },
  pauseClick: {
    src: "/music/sound effects/pause_click.wav",
    volume: 0.75,
    scope: "ui",
  },
  gameOver: {
    src: "/music/sound effects/game_over_pororon.wav",
    volume: 0.75,
    scope: "gameplay",
  },
} as const satisfies Record<string, {
  src: string;
  volume: number;
  scope: SoundEffectScope;
  minIntervalMs?: number;
}>;

export type SoundEffectName = keyof typeof SOUND_EFFECTS;

export function getChainSoundEffect(chain: number): SoundEffectName {
  const clamped = Math.min(5, Math.max(1, Math.floor(chain)));
  return `chain${clamped}` as SoundEffectName;
}

type AudioFactory = (src: string) => HTMLAudioElement;
type Clock = () => number;

type ActiveSound = {
  audio: HTMLAudioElement;
  cleanup: () => void;
  scope: SoundEffectScope;
};

export type SoundEffectPlayer = {
  playSound: (name: SoundEffectName) => boolean;
  stopGameplaySounds: () => void;
  stopAllSounds: () => void;
  dispose: () => void;
};

export function createSoundEffectPlayer(
  createAudio: AudioFactory = (src) => new Audio(src),
  now: Clock = () => performance.now(),
): SoundEffectPlayer {
  const activeSounds = new Set<ActiveSound>();
  const lastPlayedAt = new Map<SoundEffectName, number>();

  const stopMatching = (scope?: SoundEffectScope) => {
    for (const active of [...activeSounds]) {
      if (scope && active.scope !== scope) continue;
      active.audio.pause();
      active.audio.currentTime = 0;
      active.cleanup();
    }
  };

  const playSound = (name: SoundEffectName): boolean => {
    const config = SOUND_EFFECTS[name];
    const playedAt = now();
    const lastPlayed = lastPlayedAt.get(name);
    if (
      config.minIntervalMs !== undefined &&
      lastPlayed !== undefined &&
      playedAt - lastPlayed < config.minIntervalMs
    ) {
      return false;
    }
    lastPlayedAt.set(name, playedAt);

    const audio = createAudio(config.src);
    audio.preload = "auto";
    audio.volume = config.volume;
    audio.currentTime = 0;

    const active: ActiveSound = {
      audio,
      cleanup: () => undefined,
      scope: config.scope,
    };
    const cleanup = () => {
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("error", cleanup);
      activeSounds.delete(active);
    };
    active.cleanup = cleanup;
    activeSounds.add(active);
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);

    void audio.play().catch(cleanup);
    return true;
  };

  const stopGameplaySounds = () => stopMatching("gameplay");
  const stopAllSounds = () => stopMatching();
  const dispose = () => {
    stopAllSounds();
    lastPlayedAt.clear();
  };

  return { playSound, stopGameplaySounds, stopAllSounds, dispose };
}
