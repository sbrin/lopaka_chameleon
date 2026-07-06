# Lopaka Chameleon MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable Lopaka Chameleon browser MVP: anonymous sessions, public level creation, baked image upload, private mask hit checks, and a find-the-chameleon play loop.

**Architecture:** Use a Bun TypeScript monorepo with shared game contracts in `packages/game-core`, static asset manifests in `packages/assets`, browser-only rendering in `packages/rendering-web`, a React/Vite web client in `apps/web`, and a Hono API in `apps/api`. Keep React Native future-ready by placing session logic, API types, timers, coordinate mapping, and validation in shared packages; web and Expo clients should only provide platform adapters for storage, networking, and rendering.

**Tech Stack:** Bun, TypeScript, React, Vite, Three.js, Hono, Vitest, Cloudflare Workers, Cloudflare D1, Cloudflare R2, Wrangler. Supabase Auth is reserved for a later auth task; no Supabase credentials are needed for this MVP plan.

## Global Constraints

- Project directory is `/Users/sun/dev/lopaka_chameleon`.
- Package name and deployment slug use `lopaka_chameleon`.
- MVP has no Google, Facebook, email login, profiles, ratings, matchmaking, moderation queues, or leaderboards.
- Anonymous sessions are required for creating, guessing, and skipping.
- Future Supabase Auth must be easy to add through nullable `user_id` fields and session linking.
- Creator mode uses one chameleon model at fixed scale.
- Creator can change pose, rotate model, paint arbitrary colors, change brush size, and save before a 30 second timer ends.
- Creator cannot scale the model, place multiple models, or paint the background.
- Play mode receives one baked scene image and never receives the hit mask, source model, overlay, or placement data.
- Play mode gives 5 minutes to find the chameleon.
- Hit checks are server-side against a private mask with a strict `+/- 3px` silhouette tolerance.
- MVP accepts client-side baking and does not attempt strong creator-side anti-cheat.
- Cloudflare D1 stores metadata and Cloudflare R2 stores baked scenes and private masks.
- Future React Native support requires shared TypeScript contracts and platform adapters rather than browser APIs inside `packages/game-core`.

---

## File Structure

Create this structure:

```text
apps/
  api/
    src/
      app.ts
      bindings.ts
      index.ts
      repositories/
        d1-level-repository.ts
        d1-session-repository.ts
        r2-object-store.ts
      routes/
        assets.ts
        levels.ts
        session.ts
      services/
        hit-test-service.ts
    test/
      api-routes.test.ts
      hit-test-service.test.ts
    package.json
    tsconfig.json
    wrangler.jsonc
  web/
    src/
      api/
        client.ts
      app/
        App.tsx
        routes.ts
      components/
        TimerBar.tsx
      create/
        CreatorScreen.tsx
        creator-state.ts
      play/
        PlayScreen.tsx
        image-coordinates.ts
      platform/
        browser-session-store.ts
      styles.css
      main.tsx
    test/
      creator-state.test.ts
      image-coordinates.test.ts
      session-store.test.ts
    index.html
    package.json
    tsconfig.json
    vite.config.ts
packages/
  assets/
    src/
      backgrounds.ts
      poses.ts
      index.ts
    package.json
    tsconfig.json
  game-core/
    src/
      api-contracts.ts
      coordinates.ts
      ids.ts
      level-state.ts
      session.ts
      timers.ts
      validation.ts
      index.ts
    test/
      coordinates.test.ts
      level-state.test.ts
      session.test.ts
      timers.test.ts
      validation.test.ts
    package.json
    tsconfig.json
  rendering-web/
    src/
      bake.ts
      mask.ts
      paint-surface.ts
      three-scene.ts
      index.ts
    test/
      mask.test.ts
    package.json
    tsconfig.json
infra/
  cloudflare/
    migrations/
      0001_initial.sql
    r2.md
    pages.md
package.json
tsconfig.base.json
vitest.workspace.ts
```

Responsibility boundaries:

- `game-core` has no DOM, React, Worker, D1, R2, or localStorage imports.
- `assets` exposes static manifests only.
- `rendering-web` can use DOM canvas and Three.js, so it is not imported by API code or future React Native shared code.
- `apps/api` owns Hono routes, D1 access, R2 access, and private mask checking.
- `apps/web` owns React screens, browser storage, and user interaction.

---

### Task 1: Scaffold Bun Workspace And Shared TypeScript Settings

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `packages/game-core/package.json`
- Create: `packages/game-core/tsconfig.json`
- Create: `packages/assets/package.json`
- Create: `packages/assets/tsconfig.json`
- Create: `packages/rendering-web/package.json`
- Create: `packages/rendering-web/tsconfig.json`

**Interfaces:**
- Produces package names: `@lopaka/game-core`, `@lopaka/assets`, `@lopaka/rendering-web`.
- Produces root scripts: `bun run test`, `bun run typecheck`, `bun run dev:web`, `bun run dev:api`.

- [ ] **Step 1: Create root package metadata**

Write `package.json`:

```json
{
  "name": "lopaka_chameleon",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b",
    "dev:web": "bun --cwd apps/web run dev",
    "dev:api": "bun --cwd apps/api run dev",
    "build:web": "bun --cwd apps/web run build",
    "build:api": "bun --cwd apps/api run build"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260706.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0",
    "wrangler": "^4.23.0"
  }
}
```

- [ ] **Step 2: Create shared TypeScript config**

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": []
  }
}
```

- [ ] **Step 3: Create Vitest workspace config**

Write `vitest.workspace.ts`:

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);
```

- [ ] **Step 4: Create workspace package manifests and tsconfigs**

For each package/app, create a `package.json` with `type: "module"` and scripts for `test`, `typecheck`, and `build`. Use these dependencies:

```json
{
  "apps/api": {
    "dependencies": {
      "@hono/zod-validator": "^0.7.0",
      "@lopaka/assets": "workspace:*",
      "@lopaka/game-core": "workspace:*",
      "hono": "^4.8.0",
      "zod": "^4.0.0"
    }
  },
  "apps/web": {
    "dependencies": {
      "@lopaka/assets": "workspace:*",
      "@lopaka/game-core": "workspace:*",
      "@lopaka/rendering-web": "workspace:*",
      "@vitejs/plugin-react": "^5.0.0",
      "lucide-react": "^0.468.0",
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "three": "^0.178.0"
    },
    "devDependencies": {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0"
    }
  },
  "packages/rendering-web": {
    "dependencies": {
      "@lopaka/game-core": "workspace:*",
      "three": "^0.178.0"
    }
  }
}
```

Each `tsconfig.json` should extend `../../tsconfig.base.json` for apps and `../../tsconfig.base.json` for packages, set `"composite": true`, and include `src` plus `test`.

- [ ] **Step 5: Install dependencies**

Run:

```bash
bun install
```

Expected: `bun.lock` is created and all workspaces resolve.

- [ ] **Step 6: Verify baseline**

Run:

```bash
bun run typecheck
bun run test
```

Expected: typecheck passes once empty source entries exist, and Vitest reports no failing tests.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock tsconfig.base.json vitest.workspace.ts apps packages
git commit -m "chore: scaffold bun workspace"
```

---

### Task 2: Build Shared Game Core Contracts

**Files:**
- Create: `packages/game-core/src/api-contracts.ts`
- Create: `packages/game-core/src/coordinates.ts`
- Create: `packages/game-core/src/ids.ts`
- Create: `packages/game-core/src/level-state.ts`
- Create: `packages/game-core/src/session.ts`
- Create: `packages/game-core/src/timers.ts`
- Create: `packages/game-core/src/validation.ts`
- Create: `packages/game-core/src/index.ts`
- Create: `packages/game-core/test/*.test.ts`

**Interfaces:**
- Produces `AnonymousSession`, `LevelSummary`, `CreateLevelInput`, `GuessInput`, `GuessResult`.
- Produces `CREATE_SECONDS = 30`, `PLAY_SECONDS = 300`, `HIT_TOLERANCE_PX = 3`.
- Produces `mapRenderedPointToImagePoint(input: RenderedPointInput): ImagePoint`.
- Produces `createCountdown(durationMs: number, nowMs: number): CountdownState`.

- [ ] **Step 1: Write contract tests**

Create tests that assert:

```ts
import {
  CREATE_SECONDS,
  HIT_TOLERANCE_PX,
  PLAY_SECONDS,
  mapRenderedPointToImagePoint,
  validateBrushSize,
  validateRotationDegrees,
} from "../src";

expect(CREATE_SECONDS).toBe(30);
expect(PLAY_SECONDS).toBe(300);
expect(HIT_TOLERANCE_PX).toBe(3);
expect(validateBrushSize(12)).toEqual({ ok: true, value: 12 });
expect(validateBrushSize(0).ok).toBe(false);
expect(validateRotationDegrees(361)).toEqual({ ok: true, value: 1 });
expect(mapRenderedPointToImagePoint({
  clientX: 150,
  clientY: 90,
  renderedRect: { left: 50, top: 40, width: 500, height: 250 },
  imageSize: { width: 1000, height: 500 }
})).toEqual({ x: 200, y: 100 });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun --cwd packages/game-core test
```

Expected: tests fail because exports do not exist.

- [ ] **Step 3: Implement shared constants and types**

Write `api-contracts.ts` with exact exported types:

```ts
export type SessionId = string;
export type LevelId = string;

export type AnonymousSession = {
  id: SessionId;
  createdAt: string;
  lastSeenAt: string;
  userId: string | null;
};

export type LevelSummary = {
  levelId: LevelId;
  sceneUrl: string;
  imageWidth: number;
  imageHeight: number;
  playTimeLimitSeconds: 300;
};

export type CreateLevelInput = {
  backgroundId: string;
  poseId: string;
  rotation: number;
  imageWidth: number;
  imageHeight: number;
};

export type GuessInput = {
  levelId: LevelId;
  x: number;
  y: number;
  elapsedMs: number;
};

export type GuessResult = {
  hit: boolean;
  nextAction: "continue" | "load-next";
};
```

Write `timers.ts`:

```ts
export const CREATE_SECONDS = 30 as const;
export const PLAY_SECONDS = 300 as const;
export const HIT_TOLERANCE_PX = 3 as const;

export type CountdownState = {
  durationMs: number;
  startedAtMs: number;
  remainingMs: number;
  expired: boolean;
};

export function createCountdown(durationMs: number, nowMs: number): CountdownState {
  return { durationMs, startedAtMs: nowMs, remainingMs: durationMs, expired: false };
}

export function updateCountdown(state: CountdownState, nowMs: number): CountdownState {
  const elapsed = Math.max(0, nowMs - state.startedAtMs);
  const remainingMs = Math.max(0, state.durationMs - elapsed);
  return { ...state, remainingMs, expired: remainingMs === 0 };
}
```

Write `coordinates.ts`:

```ts
export type ImageSize = { width: number; height: number };
export type Rect = { left: number; top: number; width: number; height: number };
export type ImagePoint = { x: number; y: number };

export type RenderedPointInput = {
  clientX: number;
  clientY: number;
  renderedRect: Rect;
  imageSize: ImageSize;
};

export function mapRenderedPointToImagePoint(input: RenderedPointInput): ImagePoint {
  const xRatio = (input.clientX - input.renderedRect.left) / input.renderedRect.width;
  const yRatio = (input.clientY - input.renderedRect.top) / input.renderedRect.height;
  return {
    x: Math.round(xRatio * input.imageSize.width),
    y: Math.round(yRatio * input.imageSize.height),
  };
}
```

Write `validation.ts`:

```ts
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateBrushSize(value: number): ValidationResult<number> {
  if (!Number.isFinite(value) || value < 1 || value > 80) {
    return { ok: false, error: "Brush size must be between 1 and 80 pixels." };
  }
  return { ok: true, value };
}

export function validateRotationDegrees(value: number): ValidationResult<number> {
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Rotation must be a finite number." };
  }
  return { ok: true, value: ((value % 360) + 360) % 360 };
}
```

- [ ] **Step 4: Export all shared modules**

Write `index.ts`:

```ts
export * from "./api-contracts";
export * from "./coordinates";
export * from "./timers";
export * from "./validation";
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun --cwd packages/game-core test
bun run typecheck
```

Expected: all `game-core` tests pass and workspace typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add packages/game-core
git commit -m "feat: add shared game contracts"
```

---

### Task 3: Add Static Background And Pose Manifests

**Files:**
- Create: `packages/assets/src/backgrounds.ts`
- Create: `packages/assets/src/poses.ts`
- Create: `packages/assets/src/index.ts`
- Create: `packages/assets/test/assets.test.ts`
- Create: `apps/web/public/backgrounds/studio-desk.svg`
- Create: `apps/web/public/backgrounds/garden-path.svg`
- Create: `apps/web/public/models/README.md`

**Interfaces:**
- Produces `backgrounds: BackgroundAsset[]`.
- Produces `poses: PoseAsset[]`.
- Does not require downloaded MakerWorld models to compile.

- [ ] **Step 1: Write asset manifest tests**

Test that all ids are unique and all backgrounds have dimensions:

```ts
import { backgrounds, poses } from "../src";

expect(new Set(backgrounds.map((item) => item.id)).size).toBe(backgrounds.length);
expect(backgrounds.every((item) => item.width > 0 && item.height > 0)).toBe(true);
expect(poses).toEqual([
  expect.objectContaining({ id: "og-standing", fixedDisplayHeightRatio: 0.22 }),
]);
```

- [ ] **Step 2: Implement manifests**

Write `backgrounds.ts`:

```ts
export type BackgroundAsset = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};

export const backgrounds: BackgroundAsset[] = [
  { id: "studio-desk", name: "Studio Desk", src: "/backgrounds/studio-desk.svg", width: 1280, height: 720 },
  { id: "garden-path", name: "Garden Path", src: "/backgrounds/garden-path.svg", width: 1280, height: 720 },
];
```

Write `poses.ts`:

```ts
export type PoseAsset = {
  id: string;
  name: string;
  modelSrc: string;
  defaultRotation: number;
  fixedDisplayHeightRatio: number;
};

export const poses: PoseAsset[] = [
  {
    id: "og-standing",
    name: "Standing",
    modelSrc: "/models/chameleon-mvp.glb",
    defaultRotation: 0,
    fixedDisplayHeightRatio: 0.22,
  },
];
```

Write `index.ts`:

```ts
export * from "./backgrounds";
export * from "./poses";
```

- [ ] **Step 3: Add temporary SVG backgrounds**

Create two simple SVG files at `apps/web/public/backgrounds/*.svg` with `viewBox="0 0 1280 720"`. Use non-gameplay decorative shapes only; the chameleon hidden object will be created by the renderer.

- [ ] **Step 4: Add model acquisition note**

Write `apps/web/public/models/README.md`:

```md
# Chameleon Models

Place the MakerWorld chameleon model exports here after download.

Required MVP runtime path:

- `/models/chameleon-mvp.glb`

If the source download provides STL files, convert the selected fixed-size MVP pose to GLB before wiring the final renderer. The app must keep working with the built-in shaded silhouette renderer until the real file is present.
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun --cwd packages/assets test
bun run typecheck
```

Expected: asset manifest tests pass and no package imports browser-only modules.

- [ ] **Step 6: Commit**

```bash
git add packages/assets apps/web/public
git commit -m "feat: add asset manifests"
```

---

### Task 4: Create Cloudflare D1 Schema And Repository Interfaces

**Files:**
- Create: `infra/cloudflare/migrations/0001_initial.sql`
- Create: `apps/api/src/repositories/types.ts`
- Create: `apps/api/src/repositories/d1-session-repository.ts`
- Create: `apps/api/src/repositories/d1-level-repository.ts`
- Create: `apps/api/test/repositories.test.ts`

**Interfaces:**
- Produces `SessionRepository` with `createOrRefresh(sessionId?: string): Promise<AnonymousSession>`.
- Produces `LevelRepository` with `createLevel`, `getNextLevel`, `recordGuess`, `recordSkip`.

- [ ] **Step 1: Write migration**

Write `infra/cloudflare/migrations/0001_initial.sql`:

```sql
create table if not exists sessions (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_id text
);

create table if not exists levels (
  id text primary key,
  creator_session_id text not null references sessions(id),
  creator_user_id text,
  background_id text not null,
  pose_id text not null,
  rotation real not null,
  scene_object_key text not null,
  mask_object_key text not null,
  image_width integer not null,
  image_height integer not null,
  status text not null check (status in ('published', 'hidden', 'deleted')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at text
);

create index if not exists idx_levels_public_queue on levels(status, published_at, created_at);
create index if not exists idx_levels_creator_session on levels(creator_session_id);

create table if not exists guesses (
  id text primary key,
  level_id text not null references levels(id),
  session_id text not null references sessions(id),
  x integer not null,
  y integer not null,
  elapsed_ms integer not null,
  hit integer not null check (hit in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_guesses_session_level on guesses(session_id, level_id);

create table if not exists skips (
  id text primary key,
  level_id text not null references levels(id),
  session_id text not null references sessions(id),
  elapsed_ms integer not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

- [ ] **Step 2: Define repository interfaces**

Write `apps/api/src/repositories/types.ts`:

```ts
import type { AnonymousSession, CreateLevelInput, LevelId, LevelSummary, SessionId } from "@lopaka/game-core";

export type StoredLevel = {
  id: LevelId;
  creatorSessionId: SessionId;
  backgroundId: string;
  poseId: string;
  rotation: number;
  sceneObjectKey: string;
  maskObjectKey: string;
  imageWidth: number;
  imageHeight: number;
  status: "published" | "hidden" | "deleted";
};

export type NewLevelRecord = CreateLevelInput & {
  creatorSessionId: SessionId;
  sceneObjectKey: string;
  maskObjectKey: string;
};

export interface SessionRepository {
  createOrRefresh(sessionId?: string): Promise<AnonymousSession>;
  exists(sessionId: string): Promise<boolean>;
}

export interface LevelRepository {
  createLevel(input: NewLevelRecord): Promise<StoredLevel>;
  getLevel(id: LevelId): Promise<StoredLevel | null>;
  getNextLevel(sessionId: SessionId): Promise<LevelSummary | null>;
  recordGuess(input: { levelId: LevelId; sessionId: SessionId; x: number; y: number; elapsedMs: number; hit: boolean }): Promise<void>;
  recordSkip(input: { levelId: LevelId; sessionId: SessionId; elapsedMs: number }): Promise<void>;
}
```

- [ ] **Step 3: Implement D1 repositories**

Use `crypto.randomUUID()` for ids. Map snake_case database fields to camelCase TypeScript fields. `getNextLevel` should return the oldest published level not created by the current session when possible; if no such level exists, return any published level.

- [ ] **Step 4: Test repositories with a D1-compatible test database**

Use a lightweight integration test that creates an in-memory SQLite database when possible, applies `0001_initial.sql`, and verifies create session, create level, get next, record guess, and record skip.

Run:

```bash
bun --cwd apps/api test repositories
```

Expected: repository tests pass.

- [ ] **Step 5: Commit**

```bash
git add infra/cloudflare/migrations apps/api/src/repositories apps/api/test/repositories.test.ts
git commit -m "feat: add cloudflare data repositories"
```

---

### Task 5: Implement Private Mask Hit Testing

**Files:**
- Create: `apps/api/src/services/hit-test-service.ts`
- Create: `apps/api/test/hit-test-service.test.ts`
- Create: `packages/rendering-web/src/mask.ts`
- Create: `packages/rendering-web/test/mask.test.ts`

**Interfaces:**
- Produces API function `isMaskHit(mask: MaskBitmap, x: number, y: number, tolerancePx?: number): boolean`.
- Produces web function `createBinaryMaskFromAlpha(source: ImageData, alphaThreshold: number): ImageData`.

- [ ] **Step 1: Write hit-test tests**

Test a 5x5 mask with one filled center pixel:

```ts
const mask = {
  width: 5,
  height: 5,
  alphaAt: (x: number, y: number) => x === 2 && y === 2 ? 255 : 0,
};

expect(isMaskHit(mask, 2, 2, 3)).toBe(true);
expect(isMaskHit(mask, 4, 2, 3)).toBe(true);
expect(isMaskHit(mask, 0, 0, 1)).toBe(false);
expect(isMaskHit(mask, -1, 2, 3)).toBe(false);
```

- [ ] **Step 2: Implement server hit-test service**

Write `hit-test-service.ts`:

```ts
import { HIT_TOLERANCE_PX } from "@lopaka/game-core";

export type MaskBitmap = {
  width: number;
  height: number;
  alphaAt(x: number, y: number): number;
};

export function isMaskHit(mask: MaskBitmap, x: number, y: number, tolerancePx = HIT_TOLERANCE_PX): boolean {
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
```

- [ ] **Step 3: Implement web binary mask helper**

`createBinaryMaskFromAlpha` should return an `ImageData` where pixels with alpha at or above threshold become white with alpha 255, and all others become transparent black.

- [ ] **Step 4: Run tests**

Run:

```bash
bun --cwd apps/api test hit-test-service
bun --cwd packages/rendering-web test mask
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services apps/api/test/hit-test-service.test.ts packages/rendering-web
git commit -m "feat: add private mask hit testing"
```

---

### Task 6: Implement Hono API Routes With Storage Boundary

**Files:**
- Create: `apps/api/src/bindings.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/repositories/r2-object-store.ts`
- Create: `apps/api/src/routes/session.ts`
- Create: `apps/api/src/routes/assets.ts`
- Create: `apps/api/src/routes/levels.ts`
- Create: `apps/api/test/api-routes.test.ts`
- Create: `apps/api/wrangler.jsonc`

**Interfaces:**
- Produces routes from the design spec.
- Request session header: `x-lopaka-session-id`.
- Scene object keys are public or signed scene URLs; mask object keys are never returned.

- [ ] **Step 1: Write route tests**

Use Hono `app.request()` tests:

```ts
const sessionRes = await app.request("/api/session", { method: "POST" }, env);
expect(sessionRes.status).toBe(200);
const session = await sessionRes.json();
expect(session.id).toEqual(expect.any(String));

const nextRes = await app.request("/api/levels/next", {
  headers: { "x-lopaka-session-id": session.id },
}, env);
expect([200, 404]).toContain(nextRes.status);
```

Add tests that `GET /api/levels/next` response never has `maskUrl`, `mask_object_key`, `poseId`, or `rotation`.

- [ ] **Step 2: Define Cloudflare bindings**

Write `bindings.ts`:

```ts
export type Env = {
  DB: D1Database;
  LEVEL_BUCKET: R2Bucket;
  SCENE_PUBLIC_BASE_URL: string;
};
```

- [ ] **Step 3: Create Hono app factory**

Write `app.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./bindings";
import { assetsRoutes } from "./routes/assets";
import { levelsRoutes } from "./routes/levels";
import { sessionRoutes } from "./routes/session";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/api/session", sessionRoutes());
  app.route("/api/backgrounds", assetsRoutes("backgrounds"));
  app.route("/api/poses", assetsRoutes("poses"));
  app.route("/api/levels", levelsRoutes());
  return app;
}
```

- [ ] **Step 4: Implement routes**

Implement:

- `POST /api/session`
- `GET /api/backgrounds`
- `GET /api/poses`
- `POST /api/levels`
- `GET /api/levels/next`
- `POST /api/levels/:id/guess`
- `POST /api/levels/:id/skip`

For `POST /api/levels`, accept `multipart/form-data` with fields:

- `scene`: image file
- `mask`: image file
- `metadata`: JSON string matching `CreateLevelInput`

Reject missing session header with HTTP 401. Reject invalid assets or images with HTTP 400.

- [ ] **Step 5: Add Wrangler config**

Write `apps/api/wrangler.jsonc`:

```jsonc
{
  "name": "lopaka-chameleon-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-06",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "lopaka_chameleon",
      "database_id": "00000000-0000-0000-0000-000000000000"
    }
  ],
  "r2_buckets": [
    {
      "binding": "LEVEL_BUCKET",
      "bucket_name": "lopaka-chameleon-levels"
    }
  ],
  "vars": {
    "SCENE_PUBLIC_BASE_URL": "http://localhost:8787/assets"
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
bun --cwd apps/api test
bun run typecheck
```

Expected: routes pass, and tests verify private mask fields are not exposed.

- [ ] **Step 7: Commit**

```bash
git add apps/api infra/cloudflare
git commit -m "feat: add hono api routes"
```

---

### Task 7: Add Cross-Platform Web API Client And Session Store

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/platform/browser-session-store.ts`
- Create: `apps/web/test/session-store.test.ts`
- Modify: `packages/game-core/src/session.ts`
- Modify: `packages/game-core/src/index.ts`

**Interfaces:**
- Produces platform-neutral `SessionStore` interface.
- Produces browser implementation backed by localStorage.
- Produces `LopakaApiClient` class that can be reused by Expo with a different fetch base URL and storage adapter.

- [ ] **Step 1: Define session store in shared core**

Write `packages/game-core/src/session.ts`:

```ts
export type SessionStore = {
  getSessionId(): Promise<string | null>;
  setSessionId(sessionId: string): Promise<void>;
  clearSessionId(): Promise<void>;
};
```

Export it from `packages/game-core/src/index.ts`.

- [ ] **Step 2: Implement browser session store**

Write `browser-session-store.ts`:

```ts
import type { SessionStore } from "@lopaka/game-core";

export class BrowserSessionStore implements SessionStore {
  constructor(private readonly key = "lopaka_chameleon_session_id") {}

  async getSessionId(): Promise<string | null> {
    return window.localStorage.getItem(this.key);
  }

  async setSessionId(sessionId: string): Promise<void> {
    window.localStorage.setItem(this.key, sessionId);
  }

  async clearSessionId(): Promise<void> {
    window.localStorage.removeItem(this.key);
  }
}
```

- [ ] **Step 3: Implement API client**

Write `client.ts` with constructor:

```ts
export type LopakaApiClientOptions = {
  baseUrl: string;
  sessionStore: SessionStore;
  fetchImpl?: typeof fetch;
};

export class LopakaApiClient {
  constructor(options: LopakaApiClientOptions);
  ensureSession(): Promise<AnonymousSession>;
  getBackgrounds(): Promise<BackgroundAsset[]>;
  getPoses(): Promise<PoseAsset[]>;
  createLevel(input: { metadata: CreateLevelInput; scene: Blob; mask: Blob }): Promise<{ levelId: string }>;
  getNextLevel(): Promise<LevelSummary | null>;
  guess(input: GuessInput): Promise<GuessResult>;
  skip(input: { levelId: string; elapsedMs: number }): Promise<LevelSummary | null>;
}
```

All authenticated MVP requests must send `x-lopaka-session-id` from the store.

- [ ] **Step 4: Test session persistence**

Use a fake `Storage` object and fake `fetch` to verify:

- `ensureSession` reuses stored id.
- `ensureSession` stores new id from `/api/session`.
- `createLevel`, `guess`, and `skip` send `x-lopaka-session-id`.

- [ ] **Step 5: Run tests**

Run:

```bash
bun --cwd apps/web test session-store
bun run typecheck
```

Expected: session client tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/game-core/src/session.ts packages/game-core/src/index.ts apps/web/src/api apps/web/src/platform apps/web/test
git commit -m "feat: add web api client session adapter"
```

---

### Task 8: Build Web App Shell And Navigation State

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/routes.ts`
- Create: `apps/web/src/components/TimerBar.tsx`
- Create: `apps/web/src/styles.css`

**Interfaces:**
- Produces routes: `"create"` and `"play"`.
- Uses one API client instance and one session store.
- UI must be responsive for desktop and mobile browser.

- [ ] **Step 1: Implement route state**

Write `routes.ts`:

```ts
export type AppRoute = "create" | "play";
export const defaultRoute: AppRoute = "play";
```

- [ ] **Step 2: Implement app shell**

`App.tsx` should:

- Create `BrowserSessionStore`.
- Create `LopakaApiClient`.
- Call `ensureSession()` on mount.
- Render icon buttons or compact text buttons for Create and Play.
- Render `CreatorScreen` for create route and `PlayScreen` for play route.

- [ ] **Step 3: Implement timer bar**

`TimerBar` props:

```ts
export type TimerBarProps = {
  remainingMs: number;
  durationMs: number;
};
```

It renders a stable-height progress bar and a mm:ss label.

- [ ] **Step 4: Add base styles**

CSS constraints:

- No nested cards.
- Toolbar has fixed-height controls.
- Canvas/game area uses `aspect-ratio: 16 / 9`.
- Text must not scale with viewport width.
- Use a restrained multi-color palette, not a one-hue theme.

- [ ] **Step 5: Run web app smoke**

Run:

```bash
bun --cwd apps/web run build
bun --cwd apps/web test
```

Expected: build succeeds and tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: add web app shell"
```

---

### Task 9: Implement Creator State Machine And Baking Contract

**Files:**
- Create: `apps/web/src/create/creator-state.ts`
- Create: `apps/web/src/create/CreatorScreen.tsx`
- Create: `apps/web/test/creator-state.test.ts`
- Create: `packages/rendering-web/src/bake.ts`
- Create: `packages/rendering-web/src/paint-surface.ts`
- Create: `packages/rendering-web/src/three-scene.ts`
- Create: `packages/rendering-web/src/index.ts`

**Interfaces:**
- Produces `CreatorState` with selected background, selected pose, rotation, color, brush size, timer, and save status.
- Produces `bakeScene(input: BakeSceneInput): Promise<BakedLevel>`.
- `BakedLevel` contains `{ sceneBlob: Blob; maskBlob: Blob; imageWidth: number; imageHeight: number }`.

- [ ] **Step 1: Write creator state tests**

Assert:

- Initial brush size is valid.
- Rotation normalizes to 0-359.
- Scale cannot be changed because no scale action exists.
- Timer expiry sets `canPaint` to false and `shouldAutoSave` to true.

- [ ] **Step 2: Implement creator reducer**

Use a reducer with actions:

```ts
type CreatorAction =
  | { type: "select-background"; backgroundId: string }
  | { type: "select-pose"; poseId: string }
  | { type: "set-rotation"; rotation: number }
  | { type: "set-color"; color: string }
  | { type: "set-brush-size"; brushSize: number }
  | { type: "tick"; nowMs: number }
  | { type: "saving" }
  | { type: "saved"; levelId: string }
  | { type: "save-failed"; message: string };
```

Do not add a scale action.

- [ ] **Step 3: Implement baking interfaces**

Write `bake.ts`:

```ts
export type BakeSceneInput = {
  backgroundCanvas: HTMLCanvasElement;
  chameleonCanvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
  imageWidth: number;
  imageHeight: number;
};

export type BakedLevel = {
  sceneBlob: Blob;
  maskBlob: Blob;
  imageWidth: number;
  imageHeight: number;
};

export async function bakeScene(input: BakeSceneInput): Promise<BakedLevel> {
  const sceneCanvas = document.createElement("canvas");
  sceneCanvas.width = input.imageWidth;
  sceneCanvas.height = input.imageHeight;
  const ctx = sceneCanvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");
  ctx.drawImage(input.backgroundCanvas, 0, 0);
  ctx.drawImage(input.chameleonCanvas, 0, 0);
  const sceneBlob = await canvasToBlob(sceneCanvas, "image/webp", 0.9);
  const maskBlob = await canvasToBlob(input.maskCanvas, "image/png");
  return { sceneBlob, maskBlob, imageWidth: input.imageWidth, imageHeight: input.imageHeight };
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`Unable to encode ${type}.`)), type, quality);
  });
}
```

- [ ] **Step 4: Implement first CreatorScreen**

For MVP visual functionality:

- Load backgrounds from API.
- Load poses from API.
- Render selected background.
- Render a fixed-size shaded chameleon silhouette layer until the real model file is available.
- Provide color picker, brush size slider, rotation buttons/slider, save button, and 30 second timer.
- On save, call `bakeScene` and `api.createLevel`.

The first renderer may be a shaded silhouette drawn to canvas. Keep the renderer API shaped so a Three.js model can replace it without changing `CreatorScreen`.

- [ ] **Step 5: Run tests and build**

Run:

```bash
bun --cwd apps/web test creator-state
bun --cwd packages/rendering-web test
bun --cwd apps/web run build
```

Expected: creator tests pass and web build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/create packages/rendering-web apps/web/test/creator-state.test.ts
git commit -m "feat: add creator mode baking"
```

---

### Task 10: Implement Play Mode And Coordinate Mapping

**Files:**
- Create: `apps/web/src/play/image-coordinates.ts`
- Create: `apps/web/src/play/PlayScreen.tsx`
- Create: `apps/web/test/image-coordinates.test.ts`

**Interfaces:**
- Produces `getContainedImageRect(container: DOMRect, imageWidth: number, imageHeight: number): Rect`.
- Play screen uses `mapRenderedPointToImagePoint` from `@lopaka/game-core`.

- [ ] **Step 1: Test object-fit contain coordinate mapping**

Test a 1280x720 image inside square and wide containers. Assert click coordinates map to original image coordinates and clicks in letterbox area are ignored.

- [ ] **Step 2: Implement image coordinate helper**

`getContainedImageRect` should match CSS `object-fit: contain`. It returns the actual displayed image rect inside the container.

- [ ] **Step 3: Implement PlayScreen**

PlayScreen should:

- Ensure session exists.
- Fetch `GET /api/levels/next`.
- Render baked scene image only.
- Start a 5 minute timer.
- On click inside displayed image rect, send `api.guess({ levelId, x, y, elapsedMs })`.
- On hit, timeout, or skip, call `api.getNextLevel()` or `api.skip()`.
- Never request mask or source model.

- [ ] **Step 4: Run tests and build**

Run:

```bash
bun --cwd apps/web test image-coordinates
bun --cwd apps/web run build
```

Expected: mapping tests pass and play screen builds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/play apps/web/test/image-coordinates.test.ts
git commit -m "feat: add play mode"
```

---

### Task 11: Wire Cloudflare Local Development And Deployment Notes

**Files:**
- Create: `infra/cloudflare/r2.md`
- Create: `infra/cloudflare/pages.md`
- Modify: `apps/api/wrangler.jsonc`
- Modify: `package.json`

**Interfaces:**
- Produces scripts `db:migrate:local`, `dev:api:cloudflare`, and `deploy:api`.
- Documents which Supabase variables will be needed in a later auth task without requiring them now.

- [ ] **Step 1: Add root scripts**

Modify root `package.json`:

```json
{
  "scripts": {
    "db:migrate:local": "wrangler d1 migrations apply lopaka_chameleon --local --config apps/api/wrangler.jsonc",
    "dev:api:cloudflare": "wrangler dev --config apps/api/wrangler.jsonc",
    "deploy:api": "wrangler deploy --config apps/api/wrangler.jsonc"
  }
}
```

Keep existing scripts.

- [ ] **Step 2: Document R2 setup**

Write `infra/cloudflare/r2.md`:

```md
# R2 Setup

Bucket name: `lopaka-chameleon-levels`

Object layout:

- `levels/{level_id}/scene.webp`
- `levels/{level_id}/mask.png`

The scene object can be served publicly or through signed URLs. The mask object must remain private and must only be read by the API Worker.
```

- [ ] **Step 3: Document Pages setup**

Write `infra/cloudflare/pages.md`:

```md
# Cloudflare Pages Setup

Build command:

```bash
bun install && bun --cwd apps/web run build
```

Build output directory:

```text
apps/web/dist
```

Environment variables required for MVP:

- `VITE_API_BASE_URL`

Future Supabase Auth variables, not required for MVP:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
```

- [ ] **Step 4: Run local migration command**

Run:

```bash
bun run db:migrate:local
```

Expected: Wrangler applies `0001_initial.sql` to local D1.

- [ ] **Step 5: Commit**

```bash
git add package.json apps/api/wrangler.jsonc infra/cloudflare
git commit -m "chore: document cloudflare deployment"
```

---

### Task 12: Download And Register MakerWorld Model Assets

**Files:**
- Modify: `apps/web/public/models/README.md`
- Add: `apps/web/public/models/<downloaded-or-converted-model-file>`
- Modify: `packages/assets/src/poses.ts`

**Interfaces:**
- Keeps runtime pose id `og-standing`.
- Updates `modelSrc` to the actual browser-loadable model file.

- [ ] **Step 1: Download source assets**

Use the MakerWorld URL from the spec:

```text
https://makerworld.com/en/models/2947243-meccha-chameleon-characters-all-og-poses-no-ai#profileId-3331505
```

If direct download is blocked by MakerWorld auth, open the page in a browser session and download manually. Record downloaded filenames in `apps/web/public/models/README.md`.

- [ ] **Step 2: Convert if needed**

If the download is STL, convert the selected pose to GLB for browser runtime. Preserve the original file in `apps/web/public/models/source/` only if the license permits redistribution inside the repository.

- [ ] **Step 3: Update pose manifest**

Set:

```ts
modelSrc: "/models/<actual-file-name>.glb"
```

- [ ] **Step 4: Verify model loads**

Run:

```bash
bun --cwd apps/web run build
```

Expected: build succeeds. Then run a local browser smoke in Task 13 to verify the model renders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/models packages/assets/src/poses.ts
git commit -m "feat: add chameleon model asset"
```

---

### Task 13: End-To-End Smoke QA

**Files:**
- Create: `docs/qa/manual-smoke.md`
- Modify implementation files only for bugs found during this task.

**Interfaces:**
- Produces a written manual smoke record.
- Confirms masks are not exposed in play mode network responses.

- [ ] **Step 1: Start API and web dev servers**

Run in separate terminals:

```bash
bun run dev:api:cloudflare
bun run dev:web
```

Expected:

- API runs on Wrangler local URL.
- Web runs on Vite local URL.

- [ ] **Step 2: Create a level manually**

In the browser:

- Open Create.
- Pick one background.
- Pick the chameleon pose.
- Rotate it.
- Paint at least two colors.
- Save before 30 seconds expires.

Expected:

- API returns a level id.
- D1 has one `levels` row.
- R2 local storage has one `scene.webp` and one `mask.png`.

- [ ] **Step 3: Play the created level**

In the browser:

- Open Play.
- Confirm only baked scene image is visible.
- Click outside the chameleon.
- Click within the chameleon.
- Click Skip on another loaded level if available.

Expected:

- Outside click returns miss.
- Inside click returns hit.
- Hit, timeout, and skip move to next level state.

- [ ] **Step 4: Check anti-cheat boundary**

Inspect network responses for:

- `GET /api/levels/next`
- `POST /api/levels/:id/guess`

Expected:

- No `maskUrl`.
- No `mask_object_key`.
- No model URL.
- No rotation or pose placement details in play response.

- [ ] **Step 5: Write smoke record**

Write `docs/qa/manual-smoke.md` with:

```md
# Manual Smoke QA

Date: 2026-07-06

Commands:

- `bun run dev:api:cloudflare`
- `bun run dev:web`

Results:

- Anonymous session created: pass
- Level creation: pass
- Baked scene displayed in play mode: pass
- Mask hidden from play responses: pass
- Outside click miss: pass
- Inside click hit with +/- 3px tolerance: pass
- Skip loads next state: pass

Notes:

- Supabase Auth was not tested because it is outside MVP scope.
```

- [ ] **Step 6: Run final verification**

Run:

```bash
bun run typecheck
bun run test
bun --cwd apps/web run build
```

Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add docs/qa apps packages infra package.json bun.lock
git commit -m "test: add mvp smoke verification"
```

---

## Implementation Order

1. Task 1: workspace
2. Task 2: shared game contracts
3. Task 3: asset manifests
4. Task 4: D1 schema and repositories
5. Task 5: hit testing
6. Task 6: API routes
7. Task 7: web API client and session adapter
8. Task 8: web shell
9. Task 9: creator mode and baking
10. Task 10: play mode
11. Task 11: Cloudflare local/deploy wiring
12. Task 12: MakerWorld model asset
13. Task 13: end-to-end smoke QA

## React Native Readiness Checklist

- `packages/game-core` must remain DOM-free.
- API response/request types must be imported from `@lopaka/game-core`, not copied into web components.
- Session persistence uses `SessionStore`; web uses localStorage, Expo will use SecureStore or AsyncStorage.
- Rendering is isolated in `packages/rendering-web`; Expo can add `packages/rendering-expo` without changing API routes.
- `apps/web/src/api/client.ts` accepts `fetchImpl`, so Expo can reuse it with the React Native fetch implementation.
- Web screens should not encode game rules directly; use shared constants for timers and hit tolerance.

## Self-Review

Spec coverage:

- Anonymous sessions: Tasks 2, 4, 6, 7.
- Public level collection: Tasks 4, 6, 10.
- Creator 30 second loop: Tasks 2, 8, 9.
- Fixed scale with pose and rotation: Tasks 3, 9, 12.
- Baked image plus private mask: Tasks 5, 6, 9, 13.
- Play 5 minute loop with skip: Tasks 2, 6, 10.
- Server-side `+/- 3px` hit checks: Tasks 2, 5, 6, 13.
- Cloudflare Pages, Workers, D1, R2: Tasks 4, 6, 11.
- Future Supabase Auth and React Native: Global constraints, Tasks 2, 4, 7, React Native checklist.

Red-flag scan:

- No unresolved scaffolding markers are required for MVP execution.
- Cloudflare remote IDs and Supabase credentials are intentionally not required for local MVP implementation.

Type consistency:

- `SessionId`, `LevelId`, `AnonymousSession`, `CreateLevelInput`, `LevelSummary`, `GuessInput`, and `GuessResult` are defined in Task 2 and reused by later tasks.
- `SessionStore` is defined in Task 7 and consumed by the web API client.
- `HIT_TOLERANCE_PX` is defined in Task 2 and consumed by Task 5.
