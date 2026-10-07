# AI Rescheduler — implementation status (branch `cursor/ar-ai-rescheduler-implement-f350`)

**Do not merge or deploy without approval.**

## Completion pass (latest)

| Area | Status |
|------|--------|
| Live slot revalidation before calendar commit (`revalidate-slot.ts`) | Done |
| Per-day weekly hours enforced on generated slots + rules filter | Done |
| Staff Approve / Reject in appointment detail drawer + write APIs | Done |
| `ar_reschedule_reconcile` job + `reconcile-pending.ts` after provider-success / DB-failure | Done |
| Google/Microsoft drift + idempotent “already at target time” checks | Done |
| Calendar readiness on settings GET (unchanged; Opus displays `readiness`) | Done |

## Automated test results (this pass)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-ai-rescheduler.ts
# PASS test-ar-ai-rescheduler

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-ai-rescheduler-integration.ts
# PASS test-ar-ai-rescheduler-integration
```

## Still manual / live-provider

- Telnyx inbound C/R/X on production/staging number
- Microsoft Graph + Google Calendar write verification on a real connected workspace
- Full import → reminder → inbound → calendar mutation smoke (addendum §H)

## Key paths

- `src/lib/appointment-reminders/ai-rescheduler/*` (incl. `revalidate-slot.ts`, `reconcile-pending.ts`)
- `src/newui-transplant/components/appointment-reminders/appointment-detail-drawer.tsx`
- `src/app/api/appointment-reminders/ai-rescheduler/{approve,reject}/route.ts`
- `src/lib/jobs/job-handlers.ts` (`ar_reschedule_reconcile`)
