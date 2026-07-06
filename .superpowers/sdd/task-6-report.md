# Task 6 Report: Implement Hono API Routes With Storage Boundary

## Status

DONE_WITH_CONCERNS

## Files Changed

- `apps/api/src/bindings.ts`
- `apps/api/src/app.ts`
- `apps/api/src/index.ts`
- `apps/api/src/repositories/r2-object-store.ts`
- `apps/api/src/routes/assets.ts`
- `apps/api/src/routes/levels.ts`
- `apps/api/src/routes/session.ts`
- `apps/api/test/api-routes.test.ts`
- `apps/api/wrangler.jsonc`

## Summary

- Added Cloudflare binding types for D1, R2, and public scene URL configuration.
- Added a Hono app factory and Worker default export.
- Added session, asset manifest, level upload, next level, guess, and skip routes.
- Kept the play boundary explicit: next-level and guess responses are built from safe response objects and do not expose mask keys, pose IDs, rotation, source model fields, or placement details.
- Added an R2 object-store adapter so scene/mask storage and private mask reads stay behind the API boundary.
- Added route tests with fake repositories/object store covering session creation, static manifests, required `x-lopaka-session-id` auth, safe next-level payloads, multipart upload, invalid upload rejection, private-mask hit testing, and skip recording.

## Tests Run

- `bun run --cwd apps/api test` - passed, 4 files / 17 tests.
- `bun run typecheck` - passed.

## Self-Review

- Authenticated MVP routes reject missing or unknown `x-lopaka-session-id` values with HTTP 401.
- `POST /api/levels` validates multipart fields, asset IDs, image fields, and metadata before creating the D1 level row.
- `GET /api/levels/next` maps repository object keys to public scene URLs and returns 404 when no level is available.
- `POST /api/levels/:id/guess` reads the private mask through the object-store interface, records the guess, and returns only `{ hit, nextAction }`.
- `POST /api/levels/:id/skip` verifies the level exists and is published before recording the skip.

## Concerns

- The production `R2ObjectStore.getMask()` currently decodes a simple JSON mask payload (`width`, `height`, `alpha`) to avoid adding a PNG decoder dependency. The route is structured behind the private object-store and hit-test boundary, and tests use a fake mask. Real PNG mask decoding will need a follow-up dependency or a separate mask serialization format.

## Review Fix: Decode Uploaded Mask PNGs

Status: DONE

Files changed:

- `apps/api/package.json`
- `bun.lock`
- `apps/api/src/repositories/r2-object-store.ts`
- `apps/api/src/routes/levels.ts`
- `apps/api/test/api-routes.test.ts`
- `apps/api/test/r2-object-store.test.ts`

Summary:

- Added `fast-png@8.0.0` to `apps/api`.
- Replaced production `R2ObjectStore.getMask()` JSON parsing with R2 byte reads and PNG decoding.
- Extracted alpha from `fast-png` channel metadata: `channels === 4` uses RGBA alpha index `3`; `channels === 2` uses grayscale+alpha index `1`.
- `alphaAt()` now returns the decoded PNG alpha value, so transparent pixels return `0` and opaque/semi-opaque pixels return `>0`.
- Updated `POST /api/levels` validation so `scene` remains any `image/*` file while `mask` must be `image/png`.
- Added focused tests for production `R2ObjectStore` mask decoding through a small fake R2 bucket/object body using an actual 2x2 PNG byte fixture.
- Kept route responses private; no mask keys/URLs, pose, rotation, model, or placement details were added to responses.

Package API notes:

- `fast-png` exports `decode()` and `encode()` from `fast-png`.
- `decode()` accepts `ArrayBufferLike`/typed-array input and returns `{ width, height, data, depth, channels }`.
- Channel count includes alpha. The supported mask formats in this fix are RGBA (`channels: 4`) and grayscale+alpha (`channels: 2`).

Commands/results:

- `bun add --cwd apps/api fast-png` - installed `fast-png@8.0.0`, saved lockfile.
- `bun install` - passed, checked 184 installs across 262 packages, no changes.
- `bun run --cwd apps/api test` - passed, 5 files / 21 tests.
- `bun run typecheck` - passed.

Concerns:

- None.

## Review Fix: Validate Uploaded Mask PNG Bytes Before Storage

Status: DONE

Files changed:

- `apps/api/src/repositories/r2-object-store.ts`
- `apps/api/src/routes/levels.ts`
- `apps/api/test/api-routes.test.ts`
- `apps/api/test/r2-object-store.test.ts`

Summary:

- Extracted the production mask PNG byte decoder behind `R2ObjectStore.getMask()` into a reusable decode path.
- Added `isSupportedMaskPngFile()` so upload validation uses the same supported mask criteria as production decode: RGBA PNG or grayscale+alpha PNG with valid dimensions and sufficient pixel data.
- Updated `POST /api/levels` to decode-validate the mask after MIME/form validation and before generating object keys, storing scene/mask objects, or creating level metadata.
- Kept upload error responses generic and unchanged: invalid mask bytes return HTTP 400 with `Invalid level upload.`, without exposing mask keys/URLs or placement/model details.
- Updated the successful upload test to use a real decodable RGBA PNG mask.
- Added malformed `image/png` upload coverage asserting HTTP 400 with no object-store puts and no level creation.
- Added object-store validator tests for RGBA, grayscale+alpha, malformed PNG bytes, and PNG without alpha.

Commands/results:

- `bun --cwd apps/api test api-routes.test.ts` - failed before implementation as expected: malformed `image/png` mask upload returned 201 instead of 400.
- `bun --cwd apps/api test r2-object-store.test.ts` - failed before implementation as expected: `isSupportedMaskPngFile` was not yet implemented.
- `bun --cwd apps/api test api-routes.test.ts` - passed, 1 file / 10 tests.
- `bun --cwd apps/api test r2-object-store.test.ts` - passed, 1 file / 7 tests.
- `bun run --cwd apps/api test` - passed, 5 files / 26 tests.
- `bun run typecheck` - initially failed on test `File` fixture `BlobPart` typing for `Uint8Array<ArrayBufferLike>`; fixed by normalizing test byte fixtures to `ArrayBuffer`.
- `bun run --cwd apps/api test` - passed, 5 files / 26 tests.
- `bun run typecheck` - passed.

Concerns:

- None.
