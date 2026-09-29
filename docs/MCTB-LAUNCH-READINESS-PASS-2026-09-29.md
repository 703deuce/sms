# MCTB launch-readiness pass — 2026-09-29

Targeted pass before manual golden-path walkthrough (per `docs/MCTB-FUNCTIONAL-READINESS-INVENTORY.md`).

---

## FIXED

**Notification recipient delivery:** Handoff email now calls `brevoEmail.sendTransactionalEmail` with `to: recipient.email` (not `notifyWorkspaceByEmail`). Delivery audit `destination` matches the configured address. Regression: `scripts/test-mctb-handoff-recipient-email-destination.ts` (member email ≠ recipient email).

**Recipient Edit:** ⋯ on Team recipients calls `onEditRecipient` → prompts for name/email/mobile → `save()` via `/api/mctb/handoff` (same store as add).

**Notification channel/runtime reconciliation:** Non-urgent SMS rows show `—` with tooltip when `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY`; urgent SMS only when `urgentBusinessSmsEntitled`. Matrix saves use `channels.email` / `channels.sms`.

**Forwarding-health dead row:** Removed from `OPUS_EVENT_MAP` (no runtime event).

**MCTB worker state:** Production had **no** dedicated `worker:sms` container; web had `EMBEDDED_JOB_WORKER=0` + `DISABLE_INPROCESS_WORKER=1` → **no BullMQ consumers**. Enabled `EMBEDDED_JOB_WORKER=1` on the web app (Coolify `.env` + container recreate). Embedded `worker:all` now starts BullMQ consumers for `mctb`, `automations`, etc. **Scheduler container (`tgjridm6…`) is LiveKit/voice only — not MCTB SMS.** At enable time, Upstash Redis returned **rate-limit** errors on `mctb` worker attach — verify Redis is healthy before relying on inbound-reply jobs.

---

## PRODUCTION

| Item | Value |
|------|--------|
| **Master SHA** | `b48ae371cbce9f68581e4c45c642c19122f22329` |
| **Web production SHA** | `b48ae371cbce9f68581e4c45c642c19122f22329` (`GET /api/health`) |
| **MCTB worker/container** | Same web container `ds8s3hjin60qs6g7s0iqkixs-122621343024` — embedded `npm run worker:all` (not the voice scheduler) |
| **Worker code/image version** | `ds8s3hjin60qs6g7s0iqkixs:b48ae371…` |
| **Redis** | Connected (`QUEUE_DRIVER=bullmq`); **Upstash rate-limit errors** observed on worker startup (must confirm cleared) |
| **Queue consumption** | Consumers **attempt** `mctb` / `automations`; blocked until Redis healthy |
| **DB migration state** | Deploy pipeline runs `scripts/deploy-db-migrations.sh` on web build; no schema changes in this pass |

**Ops note:** Set `EMBEDDED_JOB_WORKER=1` in the Coolify UI for the web app so the next auto-deploy does not revert to `0`.

---

## READY FOR MANUAL WALKTHROUGH

**NO**

**Blockers:**

1. **Upstash Redis rate-limit** — BullMQ `mctb` / `automations` workers error at attach; caller replies may sit in queue until Redis is healthy.
2. **Persist `EMBEDDED_JOB_WORKER=1`** in Coolify (file-only change can be overwritten on the next deploy).

After Redis is healthy and worker logs show stable BullMQ consumers (no repeated `bullmq_worker_error` on `mctb`), the golden path is the right next test:

fresh account → onboarding → number → forwarding → missed call → Press 1 → SMS → reply → business notification → records

Do not pre-seed or use DB shortcuts for that test.

---

## Code reference (master)

- `src/lib/mctb/handoff/notifications.ts` — recipient-targeted Brevo send
- `src/newui-transplant/connected/mctb/setup-pages.tsx` — notifications wiring, event matrix
- `src/newui-transplant/mirror/routes/mctb/setup/notifications/page.tsx` — Edit UI, SMS disabled states
- `scripts/test-mctb-handoff-recipient-email-destination.ts` — regression test
