import { HIT_TOLERANCE_PX } from "@lopaka/game-core";

export type MaskBitmap = {
  width: number;
  height: number;
  alphaAt(x: number, y: number): number;
};

export function isMaskHit(mask: MaskBitmap, x: number, y: number, tolerancePx: number = HIT_TOLERANCE_PX): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const centerX = Math.round(x);
  const centerY = Math.round(y);

  if (centerX < 0 || centerY < 0 || centerX >= mask.width || centerY >= mask.height) return false;

  for (let dy = -tolerancePx; dy <= tolerancePx; dy += 1) {
    for (let dx = -tolerancePx; dx <= tolerancePx; dx += 1) {
      const px = centerX + dx;
      const py = centerY + dy;

      if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) continue;
      if (mask.alphaAt(px, py) > 0) return true;
    }
  }

  return false;
}
