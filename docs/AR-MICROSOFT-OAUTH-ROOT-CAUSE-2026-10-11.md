# Microsoft 365 OAuth root cause — ws_1 (2026-10-11)

## Summary

**Primary failure (Transovo-side):** The workspace had **two** `voiceCalendarConnection` rows for the **same** Microsoft account (same `microsoftUserId`). **Appointment import** remained on the older row (`cmu1uq7f15s1o5s4f6c5b6a57`) while a **newer** row (`cmtsmdoue4a4x454d4v2g3o6a`) held the only **live** refresh token. Sync always used the import row → refresh failed with `invalid_grant` → no imports.

**Not the primary cause:** Concurrent refresh-token overwrite between rows (different refresh-token fingerprints). **Not proven:** Entra SPA redirect URI (24h refresh lifetime) — production uses the standard Web OAuth callback path configured in `MICROSOFT_REDIRECT_URI` / `getMicrosoftRedirectUri()`.

## Evidence

| Signal | Import row `cmu1uq7…` | Empty row `cmtsmdou…` |
|--------|----------------------|------------------------|
| Created | 2026-09-14 | 2026-09-08 |
| `importCalendarIds` | 1 | 0 |
| Refresh fingerprint | `3fde8fd76274` | `d7ea7660881a` (different) |
| Refresh with stored token | **invalid_grant** AADSTS70000 | **OK** (3599s access) |
| Status before fix | needs_reauth | connected (misleading) |

Forensics script: `scripts/ar-microsoft-oauth-forensics.ts`

## Recovery applied (production)

`healMicrosoftSplitConnectionTokens` copied live OAuth credentials onto the import row and disconnected the duplicate. Manual verification: `syncWorkspaceCalendarConnection` → **imported: 1, updated: 20**.

## Code fixes (this branch)

1. **`healMicrosoftSplitConnectionTokens`** — before Microsoft import sync, heal same-account split brain.
2. **`resolveMicrosoftRefreshScopes`** — refresh uses stored `grantedScopes` when present (avoids scope expansion on refresh).
3. **Token refresh diagnostics** — persist merged config + richer `lastTokenRefreshError` (includes AADSTS text, redacted).
4. **PR #643 items** — OAuth consolidation, post-OAuth sync enqueue, reconnect UX (same branch).

## Customer expectation

- Ordinary **access-token** expiry: automatic refresh on the **canonical** connection row.
- **Reconnect** only when no sibling can heal and Microsoft returns non-recoverable grant errors, or first-time consent expansion.

## Remaining uncertainty

We did not prove why the **old** refresh token died (revocation vs. superseded by a second OAuth without merging). Preventing duplicate rows + heal path addresses recurrence.

## Pre-consolidation verification (2026-10-11 follow-up)

### 1. Connection uniqueness

- `resolveMicrosoftCalendarConnectionForCreate` — POST `/api/integrations/calendars` and legacy `/api/voice/calendars` reuse an active Microsoft row instead of creating another (Postgres advisory lock per workspace on create).
- `canonicalizeMicrosoftConnectionAfterOAuth` — after OAuth callback, tokens + import config are consolidated onto the **canonical** row (prefers import-enabled row; same `microsoftUserId` / tenant+email only).
- Reconnect UI still passes explicit `connectionId`; OAuth state targets that row, then canonicalize may redirect tokens to the import row.

### 2. Cross-process token refresh

- `withMicrosoftCalendarTokenRefreshLock` — in-process coalescing **plus** `pg_advisory_lock` per `connectionId` when Postgres supports it (Coolify production uses Postgres).
- After a failed refresh, `getValidAccessToken` re-reads the row once; if another instance rotated the refresh token or left a valid access token, it uses that instead of forcing reconnect.

### 3. Recovered appointment → reminder dispatch

Imported appointment `cmv40nah2382u6l42683a5y03` (created during recovery sync) has **no** `ar_reminder_dispatch` rows because import metadata set `reminderSmsEligible: false` and `remindersSuppressed: true` with `reminderSmsIneligibleReason: "organizer_not_connection"`. Calendar OAuth recovery is working; this appointment is excluded from SMS reminder discovery by existing eligibility rules (separate from OAuth).
