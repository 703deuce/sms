# Database fresh start (keep schema, wipe application data)

**Goal:** Stop legacy rows from mis-wiring routes, numbers, and MCTB/AR config while you rebuild on `new-app`. **Keep** Postgres schema (`prisma migrate` history, tables, columns). **Remove** tenant and operational **row** data so the next wiring pass starts clean.

This is **not** `prisma migrate reset` (that drops tables). This is **delete/truncate data** only.

---

## What stays vs what goes

| Keep | Wipe |
|------|------|
| All tables, indexes, migrations (`_prisma_migrations`) | Every **workspace** and **cascade** children (contacts, campaigns, MCTB, voice agents, phone numbers tied to workspaces, etc.) |
| **User** accounts (login emails/passwords) unless you opt in to delete | **Memberships** (re-created when you make a new workspace) |
| Coolify env, Telnyx account, Stripe account (outside DB) | **`job_queue`** backlog (global + per-workspace) |
| Prisma schema in repo | Stale **SolutionSetup** / per-workspace JSON that pointed UI at old routes |
| Optional: platform-admin users | Optional: **provider webhook** history tables (large; see script flags) |

**Not automatic:** Redis/BullMQ keys, Supabase Storage objects (recordings, voicemail files), Telnyx number inventory on the carrier. Those need separate steps or you will see “ghost” behavior after DB wipe.

---

## Why this helps `new-app`

- Old **workspace** rows carried mixed Phone / MCTB / AR / mass-SMS setup in one DB.
- **Multiple test workspaces** (`mctb_*`, cert workspaces) polluted production.
- **Hundreds of thousands of `job_queue` rows** made workers and health checks noisy.
- UI and APIs read **whatever was last written** — empty DB + one intentional workspace = predictable wiring.

---

## Recommended order (operator)

1. **Backup** — logical dump with a name you will recognize, e.g. `PRE_NEW_APP_FRESH_START_YYYYMMDD`. Verify `pg_restore -l` on the file.
2. **Inventory** (read-only) — see what will disappear:
   ```bash
   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
     npx tsx scripts/operations/fresh-start-wipe-tenant-data.ts
   ```
3. **Stop workers** (SMS/voice) during wipe so nothing enqueues mid-delete.
4. **Execute wipe** (irreversible without restore):
   ```bash
   EXECUTE=1 FRESH_START_CONFIRM=DELETE_ALL_WORKSPACE_DATA \
     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
     npx tsx scripts/operations/fresh-start-wipe-tenant-data.ts
   ```
5. **Redis** — flush BullMQ queues on the Transovo Redis instance (runbook: `docs/operations/MCTB-REDIS-BULLMQ-RUNBOOK.md`). Do not flush Coolify’s own Redis.
6. **Create one clean workspace** — new slug, your user as OWNER, then re-provision MCTB ingress / platform sender per runbooks (no copy-paste from old `ws_1` JSON).
7. **Turn workers back on** only after smoke test on empty state.

---

## After wipe: bootstrap checklist

- [ ] One workspace, one owner membership  
- [ ] MCTB: business line + ingress + platform sender (from provisioning code, not old DB rows)  
- [ ] Telnyx: confirm which DIDs still exist on carrier vs orphaned in deleted workspaces  
- [ ] `new-app` numbers UI reads **new** API only — no assumption that old `phoneNumber.id` values still exist  

---

## Relation to older cleanup scripts

| Script | Purpose |
|--------|---------|
| `scripts/operations/inventory-production-test-data.ts` | Classify workspaces TEST vs REAL |
| `scripts/operations/production-test-data-cleanup.ts` | Surgical delete of **known test** workspaces + global job noise; **preserves `ws_1`** |
| `scripts/operations/fresh-start-wipe-tenant-data.ts` | **Nuclear tenant reset** — all workspaces, full job queue (this doc) |

Use **fresh-start** when you intentionally want **zero** legacy tenant configuration, not just cert workspaces removed.

---

## Safety

- Default is **dry run** (counts only).
- `EXECUTE=1` requires `FRESH_START_CONFIRM=DELETE_ALL_WORKSPACE_DATA`.
- Run against production only with a verified backup and maintenance window.
- Does **not** delete `User` rows by default (`DELETE_ORPHAN_USERS=0`).
