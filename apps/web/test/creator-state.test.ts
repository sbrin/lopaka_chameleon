import { CREATE_SECONDS } from "@lopaka/game-core";
import { describe, expect, it } from "vitest";

import { createInitialCreatorState, creatorReducer } from "../src/create/creator-state";

describe("creatorReducer", () => {
  it("starts with a valid brush size", () => {
    const state = createInitialCreatorState({ nowMs: 1_000 });

    expect(state.brushSize).toBeGreaterThanOrEqual(state.brushSizeRange.min);
    expect(state.brushSize).toBeLessThanOrEqual(state.brushSizeRange.max);
  });

  it("normalizes rotation to 0-359 degrees", () => {
    const state = createInitialCreatorState({ nowMs: 1_000 });

    expect(creatorReducer(state, { type: "set-rotation", rotation: 725 }).rotation).toBe(5);
    expect(creatorReducer(state, { type: "set-rotation", rotation: -15 }).rotation).toBe(345);
  });

  it("does not support scale changes", () => {
    const state = createInitialCreatorState({ nowMs: 1_000 });

    expect("scale" in state).toBe(false);
    expect(creatorReducer(state, { type: "set-scale", scale: 2 } as never)).toBe(state);
  });

  it("expires painting and requests auto-save after the create timer ends", () => {
    const startedAtMs = 1_000;
    const state = createInitialCreatorState({ nowMs: startedAtMs });

    const expired = creatorReducer(state, {
      type: "tick",
      nowMs: startedAtMs + CREATE_SECONDS * 1_000,
    });

    expect(expired.canPaint).toBe(false);
    expect(expired.shouldAutoSave).toBe(true);
    expect(expired.remainingMs).toBe(0);
  });
});
