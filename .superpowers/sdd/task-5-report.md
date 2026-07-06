# Task 5 Report: Implement Private Mask Hit Testing

## Status

DONE

## TDD Evidence

### RED

Wrote focused tests first:

- `apps/api/test/hit-test-service.test.ts`
- `packages/rendering-web/test/mask.test.ts`

Ran focused tests before implementation:

```bash
bun run --cwd apps/api test hit-test-service
```

Result: failed because `../src/services/hit-test-service` did not exist.

```bash
bun run --cwd packages/rendering-web test mask
```

Result: failed because `../src/mask` did not exist.

### GREEN

Implemented the smallest scoped code to satisfy the tests:

- `apps/api/src/services/hit-test-service.ts`
- `packages/rendering-web/src/mask.ts`
- `packages/rendering-web/src/index.ts`

Focused test results after implementation:

```bash
bun run --cwd apps/api test hit-test-service
```

Result: 1 test file passed, 1 test passed.

```bash
bun run --cwd packages/rendering-web test mask
```

Result: 1 test file passed, 1 test passed.

Typecheck:

```bash
bun run typecheck
```

Result: passed.

## Files Changed

- `apps/api/src/services/hit-test-service.ts`
  - Added `MaskBitmap`.
  - Added `isMaskHit(mask, x, y, tolerancePx = HIT_TOLERANCE_PX)`.
  - Rejects non-finite and out-of-bounds center points.
  - Scans the tolerance square and returns true for any alpha value above 0.

- `apps/api/test/hit-test-service.test.ts`
  - Added the requested 5x5 center-pixel mask coverage.

- `packages/rendering-web/src/mask.ts`
  - Added `createBinaryMaskFromAlpha(source, alphaThreshold)`.
  - Pixels with alpha greater than or equal to threshold become white with alpha 255.
  - Pixels below threshold remain transparent black.

- `packages/rendering-web/src/index.ts`
  - Exported the mask helper.

- `packages/rendering-web/test/mask.test.ts`
  - Added binary alpha-threshold test coverage.
  - Uses a test-local `ImageData` polyfill because the current jsdom test environment does not provide `ImageData`.

## Tests Run

```bash
bun run --cwd apps/api test hit-test-service
bun run --cwd packages/rendering-web test mask
bun run typecheck
```

All required verification commands pass.

## Self-Review

- Confirmed implementation is limited to the requested files.
- Confirmed `isMaskHit` imports and uses `HIT_TOLERANCE_PX` from `@lopaka/game-core`.
- Confirmed the API hit-test behavior matches the task brief examples.
- Confirmed the rendering helper preserves dimensions and writes only binary white/transparent-black output.
- Confirmed package entrypoint exports the new rendering helper for package consumers.

## Concerns

- `ImageData` is unavailable in the current jsdom test runtime, so the mask test installs a minimal local polyfill. Browser runtime behavior still uses the native `ImageData`.
