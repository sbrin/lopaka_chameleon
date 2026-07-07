# Task 9 Report: Implement Creator State Machine And Baking Contract

## Status

DONE

## Summary

- Added `creatorReducer` and `createInitialCreatorState` with background, pose, rotation, brush, timer, paintability, auto-save, and save-status state.
- Added creator reducer tests covering valid initial brush size, rotation normalization, absence of scale support, and timer expiry auto-save behavior.
- Added `bakeScene` contract returning scene and mask blobs plus image dimensions.
- Added masked paint helpers and a placeholder shaded chameleon renderer with a Three.js-ready `renderChameleonScene` API.
- Replaced the Task 8 `CreatorScreen` placeholder with API-loaded background/pose controls, timer, painting, rotation, brush/color controls, save, and auto-save.

## TDD Evidence

### RED: Creator State

Command:

```bash
bun run --cwd apps/web test creator-state
```

Result before implementation:

- Failed as expected because `../src/create/creator-state` did not exist.
- Failure was the expected missing reducer module for the new feature.

### RED: Baking Contract

Command:

```bash
bun run --cwd packages/rendering-web test bake
```

Result before implementation:

- Failed as expected because `../src/bake` did not exist.
- Failure was the expected missing baking module for the new contract.

### GREEN

Commands:

```bash
bun run --cwd apps/web test creator-state
bun run --cwd packages/rendering-web test
bun run --cwd apps/web build
bun run typecheck
```

Final results:

- `apps/web` creator-state tests: 1 file, 4 tests passed.
- `packages/rendering-web` tests: 3 files, 3 tests passed.
- `apps/web` build: passed.
- Workspace typecheck: passed.

## Files Changed

- `apps/web/src/create/creator-state.ts`
- `apps/web/src/create/CreatorScreen.tsx`
- `apps/web/test/creator-state.test.ts`
- `packages/rendering-web/src/bake.ts`
- `packages/rendering-web/src/paint-surface.ts`
- `packages/rendering-web/src/three-scene.ts`
- `packages/rendering-web/src/index.ts`
- `packages/rendering-web/test/bake.test.ts`

## Self-Review

- Reducer action union matches the task brief and intentionally has no scale action.
- Rotation is normalized into `0..359`.
- Timer expiry sets `canPaint=false` and `shouldAutoSave=true`.
- `CreatorScreen` loads backgrounds and poses through `LopakaApiClient`.
- Canvas layers keep the background separate from the chameleon and mask.
- Painting uses `paintMaskedStroke`, which clips the chameleon layer to the generated mask so strokes do not bake onto the background.
- Save calls `bakeScene` and then `api.createLevel` with metadata, scene blob, and mask blob.
- Existing `mask.ts` exports and tests continue to pass.

## Concerns

- The placeholder renderer is intentionally a 2D shaded silhouette. It keeps the replacement API narrow for Task 12, but it is not a real GLB/Three.js model yet.
- Changing pose or rotation redraws the placeholder silhouette and mask, so existing paint strokes are not preserved across those changes. This keeps Task 9 simple and avoids adding a stroke-history model before the later rendering tasks.
- I did not implement PlayScreen or play coordinate mapping.

---

## Review Fix: Preserve Paint Across Pose And Rotation Redraws

## Status

DONE

## Summary

- Added a persistent offscreen paint canvas in `CreatorScreen`.
- Painting now records strokes onto the persistent paint canvas instead of directly mutating the rendered chameleon layer.
- Pose/rotation redraws now render the current silhouette and mask, then composite persistent paint through the current mask.
- The visible/saved scene still uses separate background, chameleon, and mask canvases; painting does not touch the background.
- Added focused `paint-surface` tests for persistent paint recording and re-compositing through changed masks.

## TDD Evidence

### RED: Persistent Paint Helpers

Command:

```bash
bun run --cwd packages/rendering-web test paint-surface
```

Result before implementation:

- Failed as expected: `paintStroke is not a function`.
- Failed as expected: `compositePaintToSurface is not a function`.

### GREEN: Focused Regression

Command:

```bash
bun run --cwd packages/rendering-web test paint-surface
```

Result after implementation:

- 1 test file passed.
- 2 tests passed.

## Required Verification

Commands:

```bash
bun run --cwd apps/web test creator-state
bun run --cwd packages/rendering-web test
bun run --cwd apps/web build
bun run typecheck
```

Results:

- `bun run --cwd apps/web test creator-state`: passed; 1 file, 4 tests.
- `bun run --cwd packages/rendering-web test`: passed; 4 files, 5 tests.
- `bun run --cwd apps/web build`: passed; Vite built 1597 modules and emitted `dist/index.html`, CSS, and JS assets.
- `bun run typecheck`: passed; `tsc -b` exited successfully.

## Files Changed

- `apps/web/src/create/CreatorScreen.tsx`
- `packages/rendering-web/src/paint-surface.ts`
- `packages/rendering-web/test/paint-surface.test.ts`
- `.superpowers/sdd/task-9-report.md`

## Concerns

- Persistent paint is stored in canvas/image coordinates and then clipped by the current mask after pose or rotation changes. This preserves painted pixels without adding model scaling, multiple models, or model-space paint projection.
