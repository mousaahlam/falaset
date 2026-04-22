# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product vision

Falaset is a mobile app that acts as a single "center" for important and useful **content and apps from all over the world**. The defining architectural constraint: the main discovery surface is a **unified feed** where curated articles/links and useful apps coexist and rank together. Keep this in mind before proposing schema or UI splits — two separate pipelines would defeat the core product.

## Stack

- **Expo SDK 51 / React Native** with the new architecture enabled (`app.json` → `newArchEnabled: true`)
- **TypeScript** in strict mode with `noUncheckedIndexedAccess`, path alias `@/* → src/*`
- **React Navigation** native stack (`RootNavigator`)
- **Supabase** (Postgres + PostgREST) as the only backend; client uses the **anon key** and relies on **RLS** for safety
- **Jest** via `jest-expo`, ESLint + Prettier

## Commands

```bash
npm install
npm start                 # Expo Dev Tools; then press i / a / w
npm run ios | android | web
npm run typecheck         # tsc --noEmit
npm run lint              # eslint . --ext .ts,.tsx
npm run format            # prettier --write
npm test                  # jest
npx jest path/to/file     # run a single test file
npx jest -t "name"        # run tests matching a name
```

Supabase local (requires Supabase CLI):
```bash
supabase start            # boots Postgres, Studio, Auth on ports in supabase/config.toml
supabase db reset         # reapplies supabase/migrations/*.sql and seed.sql
```

## Architecture

### The unified item model (most important piece)

A single Postgres table `public.items` holds **both** content and apps, discriminated by `kind ∈ {'content','app'}`. This is intentional — do **not** split it into two tables when adding features. The client renders both via the same `FeedItemCard`, ordered by `rank desc` in `src/api/feed.ts`. Country/locale are first-class filters because the audience is global.

Schema lives in `supabase/migrations/0001_initial.sql`. Row types are mirrored in `src/types/database.ts` (`ItemRow`, `Database`) so the Supabase client is typed end-to-end. When you change the SQL schema, update `database.ts` in the same change — they must stay in sync.

### Data flow

```
Supabase (items table, RLS: public read)
   └── supabase-js client (src/lib/supabase.ts)
         └── typed query helpers (src/api/*.ts)
               └── screens (src/screens/*) → components (src/components/*)
```

- `src/lib/supabase.ts` reads credentials from `process.env` first, falling back to `Constants.expoConfig.extra` (set in `app.json`). It throws at module load if either is missing — this is deliberate, don't soften it.
- `src/api/feed.ts` is the **only** place that talks to the `items` table from the app. Add new queries here, keep screens free of Supabase calls.
- Writes never happen from the mobile client. Ingestion/curation tools should use the **service role** key server-side; RLS policy only grants `select` to `anon`.

### Navigation

`RootNavigator` is a native stack with two screens: `Discover` (feed) and `ItemDetail`. Route params are typed via `RootStackParamList`; keep it authoritative when adding screens. Deep links use the `falaset://` scheme (`app.json`).

## Conventions

- **Path alias**: always import internal modules as `@/...` (e.g. `@/api/feed`). Avoid deep relative paths.
- **File layout**: `src/{api,components,lib,navigation,screens,types}`. Screens are page-level; components are reusable; `lib` is framework/glue; `api` is Supabase access; `types` is shared types.
- **Naming**: PascalCase for components/screens (`FeedItemCard.tsx`), camelCase for utilities (`fetchFeed`). One component per file, named export.
- **Styles**: co-located `StyleSheet.create` at the bottom of each component. No styling libraries yet — don't add one without discussion.
- **Errors**: throw in data layers, catch at the screen boundary and render an error state (see `DiscoverScreen`). Don't swallow.
- **Secrets**: only the anon key goes in `.env` / `app.json.extra`. The service role key must never appear in this repo.
- **Content/app parity**: when adding a field to items, think about whether it applies to both kinds. If it only applies to one, consider a sibling table keyed by `item_id` rather than sparse columns on `items`.

## Global audience considerations

- `items.locale` uses BCP-47 (e.g. `en-US`, `ar-SA`), `items.country` uses ISO 3166-1 alpha-2. Keep these formats — indexes depend on them.
- RTL: the app will eventually serve Arabic and other RTL locales. Prefer logical flex layouts (`flexDirection: 'row'` + `writingDirection`) over left/right hard-coding.
- Ranking is explicit (`items.rank`), not implicit by `created_at`. Recency is a separate axis.

## Branch policy

Active development branch for this workstream: `claude/add-claude-documentation-tOlxx`. Do not push to other branches without explicit instruction.
