export const BGM_ASSETS = {
  normal: "/music/peanutgame_music.mp3",
  rapid: "/music/peanutgame_musicrapid.mp3",
} as const;

export type BgmTrack = keyof typeof BGM_ASSETS;

export const BGM_SETTINGS = {
  switchLevel: 3,
  volume: 0.35,
  fadeMs: 250,
  storageKey: "rakkasei-bgm-enabled",
} as const;

export function getBgmTrackForLevel(level: number): BgmTrack {
  return level >= BGM_SETTINGS.switchLevel ? "rapid" : "normal";
}

export function parseBgmEnabled(value: string | null): boolean {
  if (value === "false") return false;
  return true;
}
