import type { FlowerColor } from "./game-logic";

export const FLOWER_ASSETS: Record<FlowerColor, string> = {
  yellow: "/flower_y.webp",
  pink: "/flower_r.webp",
  blue: "/flower_b.webp",
  purple: "/flower_v.webp",
};

export const GAME_ASSETS = {
  flowers: FLOWER_ASSETS,
  peanut: {
    normal: "/peanut_normal.webp",
    happy: "/peanut_happy.webp",
  },
  background: "/background.png",
  leafBorder: "/leaf-border.webp",
  mascot: "/peanutboy.png",
} as const;

export function getPeanutAsset(harvesting: boolean): string {
  return harvesting ? GAME_ASSETS.peanut.happy : GAME_ASSETS.peanut.normal;
}
