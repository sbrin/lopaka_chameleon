# Lopaka Chameleon

MVP игры "найди замаскированного хамелеона". Игроки создают сцену: выбирают фон, позу, поворачивают хамелеона, закрашивают его под фон и сохраняют уровень. Другие игроки видят только готовую картинку и пытаются кликнуть по хамелеону.

Главная идея безопасности: в play mode клиент получает только baked scene image. Приватная mask-картинка, pose id, rotation и model metadata не отдаются в игровые ответы.

## Что сейчас реализовано

- Monorepo на Bun workspaces.
- Web app на React/Vite.
- API Worker на Hono + Cloudflare Workers runtime.
- Локальные и production-подобные bindings через Wrangler.
- D1 schema для sessions, levels, guesses и skips.
- R2 storage для scene/mask assets.
- Anonymous sessions через `x-lopaka-session-id`.
- Creator mode: фон, pose, rotation, paint, save.
- Play mode: next level, click guess, hit/miss, skip.
- Anti-cheat boundary: mask хранится приватно, play responses не раскрывают технические данные позы.
- Smoke QA record: `docs/qa/manual-smoke.md`.

## Структура проекта

```text
apps/
  api/                 Cloudflare Worker API
  web/                 React/Vite web app
packages/
  assets/              background/pose manifests
  game-core/           shared contracts, timers, coordinates, validation
  rendering-web/       browser rendering, painting, mask/bake helpers
infra/
  cloudflare/
    migrations/        D1 migrations
    pages.md           current Pages setup notes
    r2.md              R2 setup notes
docs/
  qa/                  manual smoke records
  superpowers/         design spec and implementation plan
```

Important runtime files:

- `apps/api/wrangler.jsonc` defines Worker bindings.
- `infra/cloudflare/migrations/0001_initial.sql` defines D1 schema.
- `packages/assets/src/backgrounds.ts` defines public background assets.
- `packages/assets/src/poses.ts` defines pose metadata and points to `/models/chameleon-mvp.glb`.
- `apps/web/public/models/chameleon-mvp.glb` is the committed MVP model asset.

## Как работает локальная разработка

Нужны:

- Bun
- Node-compatible shell
- Wrangler через project dependency

Первый запуск:

```bash
bun install
bun run db:migrate:local
```

Запуск API:

```bash
bun run dev:api:cloudflare
```

Ожидаемый URL:

```text
http://localhost:8787
```

Запуск web app во втором терминале:

```bash
bun run dev:web
```

Ожидаемый URL:

```text
http://localhost:5173
```

В локальной разработке Vite проксирует `/api` на `http://localhost:8787`, поэтому web app может обращаться к API относительными путями. Это настроено в `apps/web/vite.config.ts`.

## Как пользоваться локально

1. Открой `http://localhost:5173`.
2. По умолчанию открывается Play mode.
3. Переключись на Create через tab в верхней панели.
4. Выбери фон, позу, rotation, цвет и brush size.
5. Закрась хамелеона.
6. Нажми Save до истечения таймера.
7. Перейди в Play и проверь созданный уровень.

Важно: сейчас routing внутри web app in-memory. Прямой URL `/create` не является настоящим route; Create открывается через tab.

## Как устроены данные

### D1

D1 хранит metadata:

- `sessions`: anonymous sessions.
- `levels`: опубликованные уровни и object keys для scene/mask.
- `guesses`: клики игроков.
- `skips`: пропуски уровней.

Локальные D1 данные Wrangler хранит в `apps/api/.wrangler/`. Эта папка игнорируется Git.

### R2

R2 хранит картинки:

- `scenes/{uuid}.webp` или другой image extension по MIME type.
- `masks/{uuid}.png`.

Scene asset можно читать публично через Worker route:

```text
GET /assets/scenes/:file
```

Mask asset публичного route не имеет. API читает mask из R2 только внутри Worker во время guess check.

### API

Основные endpoints:

- `POST /api/session`
- `GET /api/backgrounds`
- `GET /api/poses`
- `POST /api/levels`
- `GET /api/levels/next`
- `POST /api/levels/:id/guess`
- `POST /api/levels/:id/skip`
- `GET /assets/scenes/:file`

Все MVP game endpoints, которые меняют или читают player state, требуют session header:

```text
x-lopaka-session-id: <session id>
```

Web client сам создает anonymous session и хранит id в `localStorage`.

## Что защищено, а что не защищено

Защищено сейчас:

- Play response не содержит `maskUrl`, `mask_object_key`, `maskObjectKey`, `poseId`, `rotation`, `modelSrc`.
- Mask object key хранится в D1 и не отдается клиенту.
- Mask PNG лежит в R2 и читается только API Worker-ом.
- Публичный asset route сделан только для `scenes/*`, не для `masks/*`.
- Guess проверяется на сервере по alpha mask.

Не защищено или не production-grade:

- Anonymous session не является настоящей авторизацией. Это просто локальный/player id.
- Нет rate limiting.
- Нет abuse/moderation flow для загруженных уровней.
- Нет CAPTCHA или антиспама на create/guess.
- Нет signed URLs или CDN policy для scene assets; scene идет через Worker route.
- Нет real user accounts. В D1 уже есть поля под `user_id`, но Supabase/Auth не подключены.
- Нет production CORS policy review. Сейчас web и API предполагаются как связанная пара.
- Нет настоящего URL routing в web app.

## Проверки перед изменениями и перед деплоем

Базовые проверки:

```bash
bun run typecheck
bun run test
bun run --cwd apps/web build
```

Локальный smoke:

```bash
bun run db:migrate:local
bun run dev:api:cloudflare
bun run dev:web
```

Потом вручную:

- создать уровень в Create;
- открыть Play;
- проверить miss click;
- проверить hit click;
- проверить skip;
- убедиться, что network responses не раскрывают mask/pose/rotation/model fields.

Последний зафиксированный smoke record лежит здесь:

```text
docs/qa/manual-smoke.md
```

## Как подготовить API к деплою

Сейчас `apps/api/wrangler.jsonc` настроен для локального MVP:

```json
{
  "database_name": "lopaka_chameleon",
  "database_id": "00000000-0000-0000-0000-000000000000",
  "bucket_name": "lopaka-chameleon-levels",
  "SCENE_PUBLIC_BASE_URL": "http://localhost:8787/assets"
}
```

Перед production deploy нужно заменить placeholder/local values:

1. Залогиниться в Cloudflare:

```bash
bunx wrangler login
```

2. Создать production D1 database:

```bash
bunx wrangler d1 create lopaka_chameleon
```

3. Вставить реальный `database_id` в `apps/api/wrangler.jsonc`.

4. Создать R2 bucket:

```bash
bunx wrangler r2 bucket create lopaka-chameleon-levels
```

5. Проверить, что binding name остался таким же:

```text
LEVEL_BUCKET
```

6. Применить remote D1 migrations:

```bash
bunx wrangler d1 migrations apply lopaka_chameleon --remote --config apps/api/wrangler.jsonc
```

7. Заменить `SCENE_PUBLIC_BASE_URL` на production API URL:

```text
https://<api-domain>/assets
```

8. Задеплоить Worker:

```bash
bun run deploy:api
```

После deploy нужно проверить:

```bash
curl https://<api-domain>/api/backgrounds
curl -X POST https://<api-domain>/api/session
```

## Как подготовить web app к деплою

Web app можно деплоить на Cloudflare Pages.

Build command:

```bash
bun install && bun run --cwd apps/web build
```

Build output directory:

```text
apps/web/dist
```

Production env var для Pages:

```text
VITE_API_BASE_URL=https://<api-domain>
```

Локально `VITE_API_BASE_URL` обычно не нужен, потому что Vite proxy отправляет `/api` на Wrangler. В production proxy нет, поэтому web app должен знать production API base URL.

## Что еще нужно доделать именно для деплоя

Минимальный deploy checklist:

- Создать Cloudflare D1 database и заменить placeholder `database_id`.
- Создать Cloudflare R2 bucket `lopaka-chameleon-levels`.
- Применить remote D1 migrations.
- Выбрать production API domain.
- Обновить `SCENE_PUBLIC_BASE_URL` на production API domain + `/assets`.
- Задеплоить API Worker.
- Создать Cloudflare Pages project для `apps/web`.
- Добавить `VITE_API_BASE_URL` в Pages env vars.
- Задеплоить Pages.
- Прогнать production smoke: session, create, play, miss, hit, skip.

Полезно сделать до публичного запуска:

- Настроить custom domains для web и API.
- Решить, будет ли API под отдельным доменом или под `/api` рядом с web.
- Настроить CORS, если web и API будут на разных origin.
- Добавить rate limiting на create/guess/skip.
- Добавить moderation/admin способ скрывать плохие уровни.
- Добавить cleanup policy для старых R2 objects, если уровни будут удаляться.
- Добавить production observability: Worker logs, basic analytics, error alerts.
- Добавить real routing в web app, если нужны прямые ссылки `/create` и `/play`.
- Решить вопрос Supabase/Auth, если нужен не только anonymous MVP.

## Команды разработки

```bash
bun install
bun run typecheck
bun run test
bun run build:web
bun run build:api
bun run db:migrate:local
bun run dev:api:cloudflare
bun run dev:web
bun run deploy:api
```

## Текущее состояние MVP

MVP готов как локально проверенный вертикальный slice:

- creator создает уровень;
- API сохраняет scene/mask;
- play получает только scene;
- guess проверяется сервером по приватной mask;
- hit/skip двигают player queue дальше.

Для настоящего production deploy остались в основном Cloudflare-доступы, реальные resource ids/domains/env vars и production smoke после деплоя.
