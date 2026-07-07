# Manual Smoke QA

Date: 2026-07-07

Commands:

- `bun run db:migrate:local`
- `bun run dev:api:cloudflare`
- `bun run dev:web`
- `bunx wrangler d1 execute lopaka_chameleon --local --config apps/api/wrangler.jsonc --command "..."`
- `bunx --bun playwright screenshot --wait-for-timeout=1500 http://localhost:5173/play /tmp/lopaka-play-valid-smoke.png`

Results:

- Anonymous session created: pass
- Level creation: pass
- Local D1 smoke rows: pass, 2 levels, 2 guesses, 1 skip
- Local R2 scene and mask objects created: pass
- Baked scene displayed in play mode: pass
- Mask hidden from play responses: pass
- Outside click miss: pass, `(20, 20)` returned `{ "hit": false, "nextAction": "continue" }`
- Inside click hit with +/- 3px tolerance: pass, `(660, 380)` returned `{ "hit": true, "nextAction": "load-next" }`
- Skip loads next state: pass
- Browser shell loaded through Vite dev server: pass
- Vite `/api` proxy to Wrangler dev server: pass

Anti-cheat checks:

- `GET /api/levels/next`: pass, no `maskUrl`, `mask_object_key`, `maskObjectKey`, `poseId`, `rotation`, or `modelSrc`
- `POST /api/levels/:id/guess`: pass, no `maskUrl`, `mask_object_key`, `maskObjectKey`, `poseId`, `rotation`, or `modelSrc`

Smoke evidence:

- Valid WebP scene URL returned from API: `http://localhost:8787/assets/scenes/4752767e-a97c-4a19-a102-e3aa09f59ef1.webp`
- Play mode screenshot: `/tmp/lopaka-play-valid-smoke.png`

Notes:

- Supabase Auth was not tested because it is outside MVP scope.
- Two levels were created for this smoke run so hit advancement and skip behavior could both be verified.
- Direct `/create` URLs currently render the default in-memory route; Create mode is available through the app tab navigation.
