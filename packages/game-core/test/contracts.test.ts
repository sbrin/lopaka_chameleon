import { describe, expect, it } from "vitest";

import {
  CREATE_SECONDS,
  HIT_TOLERANCE_PX,
  PLAY_SECONDS,
  createCountdown,
  mapRenderedPointToImagePoint,
  updateCountdown,
  validateBrushSize,
  validateRotationDegrees,
} from "../src";

describe("game core contracts", () => {
  it("exports shared gameplay constants", () => {
    expect(CREATE_SECONDS).toBe(30);
    expect(PLAY_SECONDS).toBe(300);
    expect(HIT_TOLERANCE_PX).toBe(3);
  });

  it("validates supported brush sizes", () => {
    expect(validateBrushSize(12)).toEqual({ ok: true, value: 12 });
    expect(validateBrushSize(0).ok).toBe(false);
    expect(validateBrushSize(81).ok).toBe(false);
    expect(validateBrushSize(Number.NaN).ok).toBe(false);
  });

  it("normalizes finite rotation degrees", () => {
    expect(validateRotationDegrees(361)).toEqual({ ok: true, value: 1 });
    expect(validateRotationDegrees(-1)).toEqual({ ok: true, value: 359 });
    expect(validateRotationDegrees(Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it("maps rendered coordinates back to image coordinates", () => {
    expect(
      mapRenderedPointToImagePoint({
        clientX: 150,
        clientY: 90,
        renderedRect: { left: 50, top: 40, width: 500, height: 250 },
        imageSize: { width: 1000, height: 500 },
      }),
    ).toEqual({ x: 200, y: 100 });
  });

  it("creates and updates countdown state", () => {
    const countdown = createCountdown(30_000, 1_000);

    expect(countdown).toEqual({
      durationMs: 30_000,
      startedAtMs: 1_000,
      remainingMs: 30_000,
      expired: false,
    });
    expect(updateCountdown(countdown, 11_000)).toEqual({
      durationMs: 30_000,
      startedAtMs: 1_000,
      remainingMs: 20_000,
      expired: false,
    });
    expect(updateCountdown(countdown, 31_000)).toEqual({
      durationMs: 30_000,
      startedAtMs: 1_000,
      remainingMs: 0,
      expired: true,
    });
  });
});
