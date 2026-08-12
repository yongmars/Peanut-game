export const BGM_ASSETS = {
  farm: "/music/rakkasei_bgm_farmcute.mp3",
  advanced: "/music/rakkasei_bgm.mp3",
} as const;

export type BgmTrack = keyof typeof BGM_ASSETS;

export const BGM_SETTINGS = {
  switchLevel: 4,
  volume: 0.35,
  fadeMs: 750,
  storageKey: "rakkasei-bgm-enabled",
} as const;

export function getBgmTrackForLevel(level: number): BgmTrack {
  return level >= BGM_SETTINGS.switchLevel ? "advanced" : "farm";
}

export function parseBgmEnabled(value: string | null): boolean {
  if (value === "false") return false;
  return true;
}
