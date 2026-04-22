# Falaset

A mobile app that is a center for important and useful content and apps from all over the world. Built with Expo (React Native) and Supabase.

## Quick start

```bash
npm install
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm start              # Expo Dev Tools
```

Run the SQL in `supabase/migrations/` against your Supabase project (or `supabase db reset` locally with the Supabase CLI), then optionally `supabase/seed.sql` for sample items.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Launch Expo Dev Tools |
| `npm run ios` / `npm run android` / `npm run web` | Run on a specific platform |
| `npm run typecheck` | TypeScript project check |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm test` | Jest via `jest-expo` |
