# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product vision

Falaset is a mobile app that acts as a single "center" for important and useful **content and apps from all over the world**, plus an **agent that acts on the user's behalf** across arbitrary domains (reminders, communications, purchases, etc.). Two architectural constraints follow:

1. **Unified discovery feed**: curated articles/links and useful apps coexist in one ranked feed. Don't split the pipeline — it defeats the product.
2. **Agent is security-critical**: the app holds elevated powers on behalf of users. Every agent action requires an explicit, previewed, biometrically-confirmed authorization. The mobile client never executes actions against third parties; it requests them, and a server-side executor carries them out. See `SECURITY_MODEL.md` — it is the source of truth for auth/agent invariants.

## Stack

- **Expo SDK 51 / React Native** with the new architecture enabled (`app.json` → `newArchEnabled: true`)
- **TypeScript** in strict mode with `noUncheckedIndexedAccess`, path alias `@/* → src/*`
- **React Navigation** native stack (`RootNavigator`)
- **Supabase** (Postgres + PostgREST + Auth) backend. Mobile client uses the **anon key**; all security rides on **RLS** keyed on `auth.uid()`
- **Auth**: passkeys (WebAuthn) primary, email magic-link for recovery only. Session persisted via `@react-native-async-storage/async-storage`
- **Biometric confirmation** for agent actions via `expo-local-authentication`
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

`RootNavigator` is a native stack. Route params are typed via `RootStackParamList`; keep it authoritative when adding screens. Deep links use the `falaset://` scheme (`app.json`) — magic-link callbacks arrive on `falaset://auth/callback`.

### Agent architecture (read `SECURITY_MODEL.md` before touching)

The app holds elevated powers on behalf of users. Everything below is **non-negotiable** unless explicitly revisited in that doc.

**Tables** (all in `supabase/migrations/0002_auth_and_agent.sql`):

| Table | Who reads | Who writes |
| --- | --- | --- |
| `profiles` | Owner (self) | Owner |
| `passkeys` | Owner | Server only (writes after WebAuthn verification); owner can delete |
| `integrations` | Owner | Server connects; owner can revoke |
| `integration_secrets` | **No client**, service role only | Service role only (ciphertext) |
| `authorization_grants` | Owner | Owner (grants/revokes); server verifies before every execution |
| `action_requests` | Owner | Owner inserts `pending_confirmation`; owner updates to `confirmed`/`cancelled`; server handles all other transitions |
| `action_audit_log` | Owner reads; **append-only** (trigger blocks update/delete even for service role) | Written by trigger on `action_requests` changes |
| `rate_limits` | Service role only | Service role only |

**Action flow** (enforced end-to-end by RLS + triggers, not app code):

```
client.requestAction()   → INSERT pending_confirmation
UI shows preview         → user taps Confirm
client.confirmAction()   → expo-local-authentication prompt → UPDATE confirmed
server picks it up       → verifies grant + caps → UPDATE executing → run tool → UPDATE succeeded|failed
trigger writes audit row at every state change
```

Rules for adding a new agent capability:

1. Define an `action_kind` string (dotted, stable, versioned if needed: `reminder.create`, `payment.charge.v1`).
2. Design the `input` and `preview` JSON shapes. The preview MUST be renderable by the generic confirmation sheet (`title`, `summary`, optional `details`, `risk`, `reversible`).
3. Require a matching `authorization_grants` row before the executor will run it. Any spending action MUST check `per_action_limit` / `daily_limit`.
4. Never add a path where the mobile client calls a third-party API directly — it must go through `action_requests`. The only exception is pure local UI state.
5. For destructive/irreversible actions set `risk: 'high'`; the UI must show a distinct confirm sheet and always require biometrics.

## Conventions

- **Path alias**: always import internal modules as `@/...` (e.g. `@/api/feed`). Avoid deep relative paths.
- **File layout**: `src/{api,components,lib,navigation,screens,types}`. Screens are page-level; components are reusable; `lib` is framework/glue; `api` is Supabase access; `types` is shared types.
- **Naming**: PascalCase for components/screens (`FeedItemCard.tsx`), camelCase for utilities (`fetchFeed`). One component per file, named export.
- **Styles**: co-located `StyleSheet.create` at the bottom of each component. No styling libraries yet — don't add one without discussion.
- **Errors**: throw in data layers, catch at the screen boundary and render an error state (see `DiscoverScreen`). Don't swallow.
- **Secrets**: only the anon key goes in `.env` / `app.json.extra`. The service role key must never appear in this repo.
- **Content/app parity**: when adding a field to items, think about whether it applies to both kinds. If it only applies to one, consider a sibling table keyed by `item_id` rather than sparse columns on `items`.
- **RLS for every user-owned table**: if you add a table that references `auth.users`, you MUST enable RLS and add `auth.uid()`-keyed policies in the same migration. No exceptions. Tables that hold secrets should have *no* policies (service-role only).
- **No direct third-party calls from mobile**: agent capabilities go through `action_requests`. If you feel tempted to call an external API from a screen, read `SECURITY_MODEL.md` first.
- **Biometric gate for confirmations**: all state transitions to `confirmed` go through `src/api/actions.ts#confirmAction`, which requires `expo-local-authentication`. Don't bypass it.

## Global audience considerations

- `items.locale` uses BCP-47 (e.g. `en-US`, `ar-SA`), `items.country` uses ISO 3166-1 alpha-2. Keep these formats — indexes depend on them.
- RTL: the app will eventually serve Arabic and other RTL locales. Prefer logical flex layouts (`flexDirection: 'row'` + `writingDirection`) over left/right hard-coding.
- Ranking is explicit (`items.rank`), not implicit by `created_at`. Recency is a separate axis.

## Branch policy

Active development branch for this workstream: `claude/add-claude-documentation-tOlxx`. Do not push to other branches without explicit instruction.
