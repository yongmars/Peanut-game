export const TOUCH_SWIPE_THRESHOLD = 28;

export type TouchGesture = "move-left" | "move-right" | "hard-drop" | "rotate" | null;

export function getTouchGesture(
  deltaX: number,
  deltaY: number,
  threshold = TOUCH_SWIPE_THRESHOLD,
): TouchGesture {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (Math.max(horizontalDistance, verticalDistance) < threshold) return "rotate";
  if (horizontalDistance > verticalDistance) {
    return deltaX < 0 ? "move-left" : "move-right";
  }
  return deltaY > 0 ? "hard-drop" : null;
}
