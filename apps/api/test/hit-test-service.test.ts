import { describe, expect, it } from "vitest";

import { isMaskHit, type MaskBitmap } from "../src/services/hit-test-service";

describe("isMaskHit", () => {
  it("checks filled mask pixels within tolerance and rejects out-of-bounds points", () => {
    const mask: MaskBitmap = {
      width: 5,
      height: 5,
      alphaAt: (x: number, y: number) => (x === 2 && y === 2 ? 255 : 0),
    };

    expect(isMaskHit(mask, 2, 2, 3)).toBe(true);
    expect(isMaskHit(mask, 4, 2, 3)).toBe(true);
    expect(isMaskHit(mask, 0, 0, 1)).toBe(false);
    expect(isMaskHit(mask, -1, 2, 3)).toBe(false);
  });
});
