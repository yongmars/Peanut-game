export function shouldAutoPause(
  screenState: string,
  visibilityState: DocumentVisibilityState,
): boolean {
  return screenState === "playing" && visibilityState === "hidden";
}
