-- Unified discovery: a single table serves both curated content and app listings.
-- Client-side discrimination is via `kind`. Keeping a single table keeps the feed
-- query simple and lets us mix content + apps in one ranking pass.

create extension if not exists "pgcrypto";

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('content', 'app')),
  title       text not null,
  subtitle    text,
  description text,
  image_url   text,
  url         text not null,
  locale      text,        -- BCP-47, e.g. en-US, ar-SA
  country     text,        -- ISO 3166-1 alpha-2, e.g. US, SA
  tags        text[],
  rank        integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists items_kind_rank_idx       on public.items (kind, rank desc);
create index if not exists items_country_rank_idx    on public.items (country, rank desc);
create index if not exists items_locale_rank_idx     on public.items (locale, rank desc);
create index if not exists items_created_at_idx      on public.items (created_at desc);

-- Read-only to the world by default; writes happen via the service role
-- (admin tools / ingestion jobs), never from the mobile client.
alter table public.items enable row level security;

drop policy if exists "items are readable by anyone" on public.items;
create policy "items are readable by anyone"
  on public.items for select
  using (true);
