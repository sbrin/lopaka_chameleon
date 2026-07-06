# Lopaka Chameleon Design

Date: 2026-07-06

## Summary

Lopaka Chameleon is a fast browser hide-and-seek game. A creator places one chameleon character on a prepared 2D background, changes its pose and rotation, paints it for 30 seconds, and publishes the result as a public level. A player receives a baked image of another user's level and has up to 5 minutes to click the hidden chameleon. On a hit, timeout, or skip, the player moves to the next level.

The first implementation targets the browser and Cloudflare hosting, while keeping the architecture ready for a future Expo React Native mobile client.

## Goals

- Build the core create-and-find loop.
- Support anonymous sessions from the first version.
- Store all created levels in a public collection.
- Prevent simple client-side cheating in play mode by never sending hit masks to the browser.
- Keep the codebase structured for future Supabase Auth, rating, matchmaking, and Expo mobile.

## Non-Goals For MVP

- Google, Facebook, or email login.
- User profiles.
- Ratings, matchmaking, moderation queues, or leaderboards.
- Multiple model sizes.
- Strong creator-side anti-cheat.
- Full server-side 3D baking.

## Project Structure

The project directory is `~/Dev/lopaka_chameleon`.

Recommended monorepo layout:

```text
apps/
  web/
  api/
packages/
  game-core/
  rendering/
  assets/
infra/
  cloudflare/
docs/
  superpowers/
    specs/
```

### Apps

- `apps/web`: React browser app using Vite, Three.js, and Canvas/WebGL for creator mode and play mode.
- `apps/api`: Hono API deployed to Cloudflare Workers or Pages Functions.

### Packages

- `packages/game-core`: shared TypeScript types, API contracts, timers, validation, and level state machines.
- `packages/rendering`: browser rendering and baking pipeline. Later this can gain an Expo adapter or split into a React Native renderer package.
- `packages/assets`: model, pose, and background manifests.

### Infrastructure

- `infra/cloudflare`: Wrangler config, D1 migrations, R2 bucket setup notes, and deployment scripts.

## Technology Choices

- Bun for package management and local scripts.
- React and Vite for the browser app.
- Three.js for model preview, pose display, rotation, painting projection, and 3D-looking lighting.
- Hono for API routes.
- Cloudflare Pages for the web app.
- Cloudflare Workers or Pages Functions for API execution.
- Cloudflare D1 for metadata.
- Cloudflare R2 for baked scene images and private hit masks.
- Supabase Auth later for Google, Facebook, and email login. The MVP keeps auth out of the UI but reserves nullable `user_id` fields.

## User Flows

### Anonymous Session

When a browser first opens the app, it obtains an anonymous session from the API and stores the session token locally. That session owns created levels and play attempts. If the user later logs in through Supabase Auth, the active anonymous session should be linked to the authenticated user and its levels should remain attached.

MVP behavior:

- Anonymous sessions are required for creating, guessing, and skipping.
- Session persistence is browser-local.
- Losing local storage or cookies creates a new anonymous player.

### Creator Mode

The creator selects a prepared background and places one chameleon character on it.

Allowed controls:

- Change pose.
- Rotate the model.
- Paint the model with arbitrary colors.
- Change brush size.
- Save before the timer ends.

Not allowed in MVP:

- Scaling the model.
- Placing multiple models.
- Painting the background.

The creator has 30 seconds. On save or timer end, the client bakes:

- A single final scene image containing the full background and painted chameleon.
- A private hit mask representing the chameleon silhouette.
- Metadata including `background_id`, `pose_id`, and `rotation`.

The 3D visual should retain pseudo-3D shape: paint changes the color, while lighting and shadow remain visible so the character still has depth.

### Play Mode

The player receives a public level as a single baked scene image. The app does not receive the source model, paint strokes, overlay, or hit mask.

The player has 5 minutes to find and click the chameleon.

On click:

- The client sends `level_id`, x/y coordinates, viewport/image dimensions, and elapsed time.
- The API maps the click to the original image coordinate space.
- The API checks the private mask with a strict `+/- 3px` tolerance around the silhouette.
- The API records the guess and returns hit or miss.

On hit, timeout, or skip, the player receives another level.

## Data Model

### `sessions`

- `id`
- `created_at`
- `updated_at`
- `last_seen_at`
- `user_id` nullable, reserved for future Supabase Auth linking

### `levels`

- `id`
- `creator_session_id`
- `creator_user_id` nullable
- `background_id`
- `pose_id`
- `rotation`
- `scene_object_key`
- `mask_object_key`
- `image_width`
- `image_height`
- `status`
- `created_at`
- `published_at`

`status` starts simple: `published`, `hidden`, or `deleted`. MVP-created levels can go straight to `published`.

### `guesses`

- `id`
- `level_id`
- `session_id`
- `x`
- `y`
- `elapsed_ms`
- `hit`
- `created_at`

### `skips`

- `id`
- `level_id`
- `session_id`
- `elapsed_ms`
- `created_at`

### Asset Manifests

For MVP, backgrounds and poses can be static manifests rather than database tables:

- `background_id`
- image URL or local asset path
- dimensions
- display name

Pose manifest:

- `pose_id`
- model file or pose preset
- display name
- default rotation
- fixed placement size rules

## API

### `POST /api/session`

Creates or refreshes an anonymous session.

### `GET /api/backgrounds`

Returns available level backgrounds.

### `GET /api/poses`

Returns available chameleon poses.

### `POST /api/levels`

Uploads the baked scene image, private hit mask, and metadata.

Validation:

- Requires a valid anonymous session.
- Requires known `background_id` and `pose_id`.
- Rejects missing scene image or mask.
- Rejects unsupported image formats.
- Stores scene and mask in R2.
- Stores metadata in D1.

### `GET /api/levels/next`

Returns the next public level for play mode.

Response includes:

- `level_id`
- signed or public scene image URL
- image dimensions
- play time limit

Response must not include:

- mask URL
- model URL
- overlay URL
- creator placement details that make the answer obvious

### `POST /api/levels/:id/guess`

Checks one click against the private hit mask.

Request includes:

- image-space x/y coordinates, or enough rendered image geometry to map to image space
- elapsed time

Response includes:

- `hit`
- next-step hint for the client, such as continue or load next

### `POST /api/levels/:id/skip`

Records a skip and can return the next level.

## Anti-Cheat Boundary

The MVP uses client-side baking. This is acceptable for speed, but it means a malicious creator could submit a manipulated mask. The MVP protects against simple player-side cheating by keeping the mask private and checking guesses through the API.

The API contract should preserve enough metadata to support a later server-verified pipeline, where the server can validate or regenerate the mask from pose and placement data.

## Cloudflare Storage

Use D1 for metadata and R2 for binary files.

Suggested R2 keys:

```text
levels/{level_id}/scene.webp
levels/{level_id}/mask.png
```

The scene image can be publicly readable or delivered through signed URLs. The mask must be private and readable only by the API.

## Rendering Notes

Creator rendering needs separate conceptual layers:

- Background image.
- Chameleon base color or paint layer.
- Lighting/shadow pass.
- Silhouette/mask pass.

The final scene image flattens the visible layers into one image. The mask pass is uploaded separately and never shown to play-mode clients.

Painting should only affect the chameleon surface. Brush size and arbitrary colors are required for MVP.

## Testing Strategy

Focused tests:

- API session creation and persistence.
- Level creation validation.
- R2/D1 persistence adapter tests where practical.
- Hit-test coordinate mapping.
- `+/- 3px` mask tolerance behavior.
- Client state transitions for creator timer and play timer.

Manual QA:

- Create a level, save it, and verify it appears in play mode.
- Confirm play mode network responses do not expose masks or source placement data.
- Click inside and outside the chameleon shape and verify hit behavior.
- Verify skip and timeout move to another level.

## Open Implementation Notes

- Actual MakerWorld model file names and licenses must be checked when downloading the assets.
- If MakerWorld blocks unauthenticated download, model acquisition may require an authenticated browser session or manual export by the user.
- Background image set is not defined yet; MVP can start with a small curated local set.
- Exact mobile renderer choices should be revisited when the Expo client begins, but shared types and API contracts should be built now.
