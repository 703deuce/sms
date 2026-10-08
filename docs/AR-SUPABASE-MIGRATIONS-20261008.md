# AR Supabase migrations — validation (do not apply to production without approval)

Migrations for PR #616 session routing and held inbound:

| Migration | Purpose |
|-----------|---------|
| `20261008130000_ar_sms_reply_session` | `ar_sms_reply_sessions`, `ArSmsReplySessionState` enum, `ConversationProductSource` value |
| `20261008140000_ar_sms_inbound_held` | `ar_sms_inbound_held_messages`, `ArSmsInboundHeldState` enum |

## Pre-apply checklist

1. **Table naming:** Prisma migration SQL references quoted identifiers (`"Workspace"`, `"PhoneNumber"`, `"Conversation"`). Confirm these match the live Supabase/Postgres catalog (this repo uses Supabase PostgREST with mixed casing). If production uses lowercase `workspaces`, adjust FK statements before apply or use a migration repair pass.
2. **Enums:** `ALTER TYPE "ConversationProductSource" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REMINDERS'` is safe on Postgres 12+; verify enum exists in target DB.
3. **Indexes:** Session indexes on `(workspaceId, appointmentId)`, `(consumerE164, platformPhoneNumberId, lifecycleState)`, and held-message indexes are required for inbound routing at scale.
4. **RLS:** If Row Level Security is enabled on tenant tables, add policies for service-role-only access on new tables (match existing `voice_appointments` / MCTB patterns). **Do not** expose these tables to anon/authenticated clients without explicit product review.
5. **Compat layer:** After apply, confirm PostgREST schema cache reload (Supabase dashboard or API) so `ar_sms_reply_sessions` is visible to `src/lib/supabase/prisma-compat.ts` models `arSmsReplySession` and `arSmsInboundHeldMessage`.

## Apply commands (owner-run on approved environment)

```bash
# On approved staging or production (after backup):
npm run db:deploy
# or:
npx prisma migrate deploy
```

## Production apply log (2026-10-08)

| Migration | Result |
|-----------|--------|
| `20261008130000_ar_sms_reply_session` | Applied successfully |
| `20261008140000_ar_sms_inbound_held` | First attempt failed: FK referenced `"workspaces"` (table is `"Workspace"`). Migration marked rolled back; SQL fixed; re-applied successfully. |

Verified tables present: `ar_sms_reply_sessions`, `ar_sms_inbound_held_messages`.

## Rollback / recovery

Postgres DDL rollback is not automatic. Recovery procedure:

1. Stop AR inbound workers that write `ar_sms_reply_sessions` / held messages.
2. If migration partially applied, inspect `\d ar_sms_reply_sessions` and enum types.
3. To revert (destructive): `DROP TABLE IF EXISTS ar_sms_inbound_held_messages CASCADE;` then `DROP TABLE IF EXISTS ar_sms_reply_sessions CASCADE;` — only if no production data depends on sessions.
4. Re-deploy previous application revision if new code depends on tables.

## Post-apply verification (staging)

```bash
export AR_TEST_SUPABASE_URL=...
export AR_TEST_SUPABASE_SERVICE_ROLE_KEY=...
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-pr616-backend-verification.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-ar-billing-concurrency.ts
```

Expected: session-bound pipeline **PASS** (not CONFIG), billing concurrency **PASS**.
