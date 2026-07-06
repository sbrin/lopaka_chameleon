import { describe, expect, it } from "vitest";

import { backgrounds, poses } from "../src";

describe("asset manifests", () => {
  it("keeps background ids unique", () => {
    expect(new Set(backgrounds.map((item) => item.id)).size).toBe(backgrounds.length);
  });

  it("defines dimensions for every background", () => {
    expect(backgrounds.every((item) => item.width > 0 && item.height > 0)).toBe(true);
  });

  it("includes the MVP standing pose", () => {
    expect(poses).toEqual([
      expect.objectContaining({ id: "og-standing", fixedDisplayHeightRatio: 0.22 }),
    ]);
  });
});
