# Production deploy verification — 2026-10-15

## Deploys (GitHub `master` → Coolify web `ds8s3hjin60qs6g7s0iqkixs`)

| Commit | Coolify status | `/api/health` `commitSha` |
|--------|----------------|---------------------------|
| `3d0e9ca36` | finished 2026-10-15 03:44 UTC | matched after container swap |
| `2bee87ab0` | finished 2026-10-15 04:08 UTC | **live** at time of v2 audit |

**Scheduler** (`tgjridm6vrmrgljkfrr0rpjn`) was **not** redeployed (manual-only per ops model; still on Oct 13 image). No scheduler code changed in this pass.

**Local `npm run build`:** OOM-killed on Cloud Agent VM (not used as gate). **Coolify Nixpacks build passed** for both commits.

## Migrations

Applied on web container startup via `deploy-db-migrations.sh` (with `3d0e9ca36` deploy):

- `20261015103000_reputation_contacts_engagement_columns`
- `20261015114500_voice_appointments_updated_at`

## Post-deploy API probe (cert browser account)

After `2bee87ab0`:

| Endpoint | HTTP |
|----------|------|
| `GET /api/appointment-reminders/reminders/workspace` | **200** |
| `GET /api/appointment-reminders/reminders/test?step=confirmation` | **200** |
| `GET /api/appointment-reminders/reminders/test?step=reminder24h` | **200** |
| `GET /api/appointment-reminders/reminders/test?step=reminder2h` | **200** |

**Follow-up fix (`2bee87ab0`):** `reminders/test` imported `analyzeSmsBody` from `@/lib/mctb/sms-channel` (not re-exported in prod bundle) → **500** `(0 , k.analyzeSmsBody) is not a function`. Fixed to `@/lib/sms/segment-encoding`.

## Route smoke (Playwright, transovo.ai)

| Artifact | Failures |
|----------|----------|
| `four-products-route-audit-post-deploy-2026-10-15.json` (after `3d0e9ca36`) | **3** — AR Sequences, Settings, Templates (`reminders/test` 500) |
| `four-products-route-audit-post-deploy-2026-10-15-v2.json` (after `2bee87ab0`) | **0** — all routes **LOAD_OK** |

Previously failing areas now **LOAD_OK** in v2:

- `/appointment-reminders/reminders/sequences`
- `/appointment-reminders/settings`
- `/appointment-reminders/reminders/templates`
- `/appointment-reminders/ai-rescheduler`
- `/templates`
- `/reviews/contacts`

## Not verified in this pass

- AR reminder sequence **save → reload** (manual or `scripts/test-ar-reminder-sequence-persist.ts` on DB)
- Live SMS / PSTN
- SMS worker commit parity (`deployment.smsWorkerCommitSha` null on health JSON)

## Re-run commands

```bash
curl -sS https://transovo.ai/api/health
UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts
npx tsx scripts/probe-prod-ar-apis.ts
```
