export const TUTORIAL_STORAGE_KEY = "rakkasei-tutorial-seen";

export function parseTutorialSeen(value: string | null): boolean {
  return value === "true";
}
