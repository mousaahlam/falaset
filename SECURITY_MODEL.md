# Security model

Falaset's agent acts on a user's behalf across arbitrary domains, so the
security posture is "assume high blast radius by default." This document is
the source of truth for *why* each table and policy exists. If you change
the security model, update this document in the same commit.

## Threat model (what we protect against)

| Threat | Mitigation |
| --- | --- |
| Device theft | Passkeys are device-bound; biometric unlock required to release tokens; short-lived access tokens |
| Account takeover via phishing | Passkey-only primary auth (phishing-resistant); email magic-link for recovery only |
| Lost device lockout | Two passkeys enrolled at signup (primary + backup device) |
| Malicious / compromised mobile binary | Mobile client cannot execute agent actions; cannot decrypt third-party tokens; cannot transition action state past `confirmed` |
| Silent agent actions | Every action has a user-approved preview + biometric confirmation + audit log row |
| Compromised server / ops insider | Secrets encrypted with a KEK held outside Postgres; audit log is append-only even to the service role |
| Cross-user data leak | RLS denies by default; every user-owned table has policies keyed on `auth.uid()`; secrets tables have no policies at all |
| Replay / duplicate submission | `action_requests.idempotency_key` is unique per `(user_id, idempotency_key)` |
| Cost blow-up | `authorization_grants.per_action_limit` and `daily_limit` (server-enforced) plus rate limits per bucket |

## Layers of defense

### 1. Identity: passkeys primary, magic-link recovery only

- **Primary login**: WebAuthn passkey via `react-native-passkeys` (to be added). Server verifies attestations/assertions and mints a Supabase session.
- **Required at signup**: two passkeys on two devices, so no single lost device locks the account out.
- **Recovery**: email magic-link. Magic-link sessions are marked and cannot confirm high-risk actions until a passkey is re-registered.
- **MFA**: a passkey is already possession + biometric. We do not layer TOTP on top unless explicitly requested.

### 2. Authorization: grants, scopes, and caps

The agent cannot act without an `authorization_grants` row that:

- Names the `action_kind` (e.g. `reminder.create`, `payment.charge`)
- Optionally binds to an `integration_id` (specific connected account)
- Carries `per_action_limit`, `daily_limit`, `currency` where applicable
- Has not expired (`expires_at`) or been revoked (`revoked_at`)

The server-side executor **must** verify the matching grant before execution. Clients can read, create, update, and revoke their own grants; they never execute.

### 3. Per-request consent: action_requests state machine

```
pending_confirmation ──(user biometric)──▶ confirmed
         │                                      │
         └──(user cancels)──▶ cancelled         ▼
                                            executing
                                                │
                                     ┌──────────┴──────────┐
                                     ▼                     ▼
                                 succeeded              failed
```

- Clients can **insert** only `pending_confirmation` rows.
- Clients can **update** only to `confirmed` or `cancelled` (enforced by RLS).
- All other transitions are service-role only.
- Every action carries a `preview` (title, summary, details, risk level) that the confirmation sheet renders before the user authorizes.
- Biometric / passkey re-auth is required to flip a request to `confirmed` (enforced by `src/api/actions.ts#confirmAction`).

### 4. Audit log: append-only

- `action_audit_log` rows are written by triggers on `action_requests` state changes, so they cannot be forgotten by application code.
- A DB trigger blocks `UPDATE`/`DELETE` even from the service role.
- Users can read their own audit rows; no writes/deletes via client.

### 5. Secrets: encrypted outside Postgres

- Third-party tokens live in `integration_secrets.ciphertext`.
- Encryption uses a KEK held by the server process (KMS / Vault / Supabase Vault). The DB only sees ciphertext.
- `integration_secrets` has **no RLS policies** — it is entirely unreachable from anon/authenticated roles. Only the service role reads it, server-side, momentarily, to perform an action.
- Tokens are never returned to the mobile client.

### 6. Runtime enforcement (server-side executor)

Not yet built. Whatever runtime we pick (Edge Function vs separate service) **must**:

1. Authenticate the service-role caller.
2. Claim an `action_requests` row where `status = 'confirmed'` and flip to `executing` using optimistic concurrency.
3. Re-verify the matching `authorization_grant` and spend caps.
4. Dispatch to a registered handler for `action_kind`.
5. Update status to `succeeded` / `failed` with a sanitized result.
6. Bump `rate_limits` for the relevant bucket.

Every step is covered by the audit log via triggers.

## Invariants (tested or to-be-tested)

- [ ] No RLS policy allows cross-user read on any user-owned table.
- [ ] `integration_secrets` is unreadable for both anon and authenticated roles.
- [ ] `action_audit_log` cannot be updated or deleted, even by the service role.
- [ ] `action_requests` cannot be inserted in any status other than `pending_confirmation` by a client.
- [ ] `action_requests` cannot be updated to `executing` / `succeeded` / `failed` by a client.
- [ ] An action without a matching, non-revoked, unexpired `authorization_grant` is rejected by the executor.
- [ ] Service role key never ships in a mobile binary.

## Non-negotiables

- The service role key does not reach the client, ever.
- No `select *` from `integration_secrets` in application code — only short, audited helpers on the server.
- Destructive / spending actions always require biometric re-auth, even inside an active session.
- Revocation is immediate and first-class. Disconnecting an integration wipes tokens and expires open grants.
