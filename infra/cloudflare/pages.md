# Cloudflare Pages Setup

Build command:

```bash
bun install && bun run --cwd apps/web build
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
