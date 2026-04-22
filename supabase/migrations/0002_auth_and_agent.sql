-- Auth + agent foundation.
--
-- Design principles (see SECURITY_MODEL.md):
--   1. Every user-owned table has RLS keyed on auth.uid().
--   2. Secrets are stored as ciphertext and have NO RLS policies — only the
--      service role can access them. Clients never decrypt tokens.
--   3. action_audit_log is append-only: triggers block UPDATE/DELETE even
--      from the service role. Audit rows are written automatically on
--      action_request state transitions.
--   4. Clients may INSERT action_requests in 'pending_confirmation' and
--      UPDATE them only to 'confirmed' or 'cancelled'. Every other state
--      transition happens server-side.

-- ============================================================
-- Profiles
-- ============================================================
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale       text,
  country      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self insert" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

create policy "profiles self read"   on public.profiles for select using (user_id = auth.uid());
create policy "profiles self insert" on public.profiles for insert with check (user_id = auth.uid());
create policy "profiles self update" on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Passkeys (WebAuthn credentials)
--   Server (service role) writes credential registrations and sign_count
--   updates after verifying attestations/assertions. Clients can list and
--   delete their own passkeys for management UI.
-- ============================================================
create table if not exists public.passkeys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key    bytea not null,
  sign_count    bigint not null default 0,
  device_label  text,
  transports    text[],
  aaguid        uuid,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists passkeys_user_idx on public.passkeys (user_id);

alter table public.passkeys enable row level security;

drop policy if exists "passkeys self read"   on public.passkeys;
drop policy if exists "passkeys self delete" on public.passkeys;

create policy "passkeys self read"   on public.passkeys for select using (user_id = auth.uid());
create policy "passkeys self delete" on public.passkeys for delete using (user_id = auth.uid());
-- No insert/update policy: verification happens server-side.

-- ============================================================
-- Integrations (connected third-party accounts)
-- ============================================================
create table if not exists public.integrations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null,
  account_ref  text,
  status       text not null default 'active' check (status in ('active', 'revoked')),
  connected_at timestamptz not null default now(),
  revoked_at   timestamptz,
  unique (user_id, provider, account_ref)
);
create index if not exists integrations_user_idx on public.integrations (user_id);

alter table public.integrations enable row level security;

drop policy if exists "integrations self read"   on public.integrations;
drop policy if exists "integrations self update" on public.integrations;

create policy "integrations self read"   on public.integrations for select using (user_id = auth.uid());
-- Users can mark as revoked; connecting happens server-side after OAuth flow.
create policy "integrations self update" on public.integrations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'revoked');

-- ============================================================
-- Integration secrets (encrypted third-party tokens).
--   No RLS policies: unreachable by anon/authenticated roles.
--   Only the service role (server) can read/write.
-- ============================================================
create table if not exists public.integration_secrets (
  integration_id uuid primary key references public.integrations(id) on delete cascade,
  ciphertext     bytea not null,
  kek_ref        text not null,
  created_at     timestamptz not null default now(),
  rotated_at     timestamptz
);
alter table public.integration_secrets enable row level security;
-- Deliberately no policies.

-- ============================================================
-- Authorization grants (what the agent may do per user/integration)
-- ============================================================
create table if not exists public.authorization_grants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  integration_id   uuid references public.integrations(id) on delete cascade,
  action_kind      text not null,
  scope            jsonb not null default '{}'::jsonb,
  per_action_limit numeric,
  daily_limit      numeric,
  currency         text,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists grants_user_kind_idx on public.authorization_grants (user_id, action_kind);

alter table public.authorization_grants enable row level security;

drop policy if exists "grants self read"   on public.authorization_grants;
drop policy if exists "grants self insert" on public.authorization_grants;
drop policy if exists "grants self update" on public.authorization_grants;

create policy "grants self read"   on public.authorization_grants for select using (user_id = auth.uid());
create policy "grants self insert" on public.authorization_grants for insert with check (user_id = auth.uid());
create policy "grants self update" on public.authorization_grants for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Action request state machine
-- ============================================================
do $$ begin
  create type public.action_status as enum
    ('pending_confirmation', 'confirmed', 'executing', 'succeeded', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.action_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  action_kind         text not null,
  input               jsonb not null,
  preview             jsonb not null,
  status              public.action_status not null default 'pending_confirmation',
  confirmation_method text,            -- 'biometric', 'passkey', null
  idempotency_key     text,
  result              jsonb,
  error               text,
  created_at          timestamptz not null default now(),
  confirmed_at        timestamptz,
  executed_at         timestamptz,
  unique (user_id, idempotency_key)
);
create index if not exists action_requests_user_status_idx
  on public.action_requests (user_id, status, created_at desc);

alter table public.action_requests enable row level security;

drop policy if exists "actions self read"     on public.action_requests;
drop policy if exists "actions self insert"   on public.action_requests;
drop policy if exists "actions self confirm"  on public.action_requests;

create policy "actions self read" on public.action_requests for select using (user_id = auth.uid());

-- Clients can only submit a request that starts in pending_confirmation.
create policy "actions self insert" on public.action_requests for insert
  with check (user_id = auth.uid() and status = 'pending_confirmation');

-- Clients can only confirm or cancel their pending requests.
create policy "actions self confirm" on public.action_requests for update
  using (user_id = auth.uid() and status = 'pending_confirmation')
  with check (user_id = auth.uid() and status in ('confirmed', 'cancelled'));
-- executing/succeeded/failed transitions are service-role only.

-- ============================================================
-- Append-only audit log
-- ============================================================
create table if not exists public.action_audit_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete restrict,
  request_id  uuid references public.action_requests(id) on delete set null,
  event       text not null,
  detail      jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists audit_user_time_idx on public.action_audit_log (user_id, occurred_at desc);
create index if not exists audit_request_idx  on public.action_audit_log (request_id);

alter table public.action_audit_log enable row level security;

drop policy if exists "audit self read" on public.action_audit_log;
create policy "audit self read" on public.action_audit_log for select using (user_id = auth.uid());
-- No insert/update/delete policies: only the service role writes, and the
-- triggers below block mutation even for the service role.

create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'action_audit_log is append-only';
end $$;

drop trigger if exists audit_block_update on public.action_audit_log;
drop trigger if exists audit_block_delete on public.action_audit_log;

create trigger audit_block_update before update on public.action_audit_log
  for each row execute function public.prevent_audit_mutation();
create trigger audit_block_delete before delete on public.action_audit_log
  for each row execute function public.prevent_audit_mutation();

-- Automatically record state transitions on action_requests into the audit log.
create or replace function public.log_action_event()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.action_audit_log (user_id, request_id, event, detail)
    values (new.user_id, new.id, 'requested',
      jsonb_build_object('action_kind', new.action_kind));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.action_audit_log (user_id, request_id, event, detail)
    values (new.user_id, new.id, new.status::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

drop trigger if exists action_request_audit on public.action_requests;
create trigger action_request_audit
  after insert or update on public.action_requests
  for each row execute function public.log_action_event();

-- ============================================================
-- Rate limits (server-only)
-- ============================================================
create table if not exists public.rate_limits (
  user_id      uuid not null references auth.users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- No policies: service role only.
