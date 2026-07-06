import { describe, expect, it } from "vitest";

import { createBinaryMaskFromAlpha } from "../src/mask";

class TestImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

globalThis.ImageData = TestImageData as typeof ImageData;

describe("createBinaryMaskFromAlpha", () => {
  it("turns alpha values at or above the threshold white and leaves the rest transparent", () => {
    const source = new ImageData(
      new Uint8ClampedArray([
        10, 20, 30, 127,
        40, 50, 60, 128,
        70, 80, 90, 255,
      ]),
      3,
      1,
    );

    const mask = createBinaryMaskFromAlpha(source, 128);

    expect(mask.width).toBe(3);
    expect(mask.height).toBe(1);
    expect(Array.from(mask.data)).toEqual([
      0, 0, 0, 0,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]);
  });
});
