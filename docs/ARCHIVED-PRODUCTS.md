# Archived Products

Production Transovo was reduced to **Missed Call Text Back (MCTB) only** on 2026-08-25.

## Archive repository

| Field | Value |
|-------|-------|
| URL | https://github.com/703deuce/smsarchive.git |
| Local commit (push pending credentials) | `719c3d9` |
| Source tag | `pre-mctb-extraction-2026-08-25` |
| Source branch snapshot | `archive/pre-mctb-extraction-2026-08-25` |
| Extraction branch | `cleanup/mctb-only-production` |

> **Note:** The archive was committed locally at `/tmp/transovo-archive` (commit `719c3d9`). Push to GitHub failed with `403` for `cursor[bot]` — repository owner must grant write access or push manually.

## Products archived

See `docs/PRODUCT-CODE-INVENTORY.md` and archive `ARCHIVE_MANIFEST.md`.

Major areas: Smart Routing (UI/runtime product), Realtor, Personal Numbers, Number Marketplace, Phone/PBX, Call Forwarding product, AI Receptionist, SMS Marketing (campaigns/contacts/automations/grow), Solutions/Outcomes launcher, Visual Voicemail, AI Transcription, Callback Requests, deep CRM integrations, dev/demo routes.

## Shared runtime preserved in production

Some modules remain because MCTB press-1 consent and Telnyx ingress depend on them:

- `src/lib/smart-routing/` — consent audio, `recordSmsConsent`, Telnyx provider (not customer SR UI)
- `src/lib/solutions/missed-call-text-back/` — MCTB setup persistence
- `src/lib/agents/missed-call-text-back/` — core MCTB agent

## Restoration

1. Check out archive commit `719c3d9` (or remote once pushed).
2. Compare shared interfaces on current `master` / extraction branch.
3. Cherry-pick product tree into a feature branch.
4. Reconcile Prisma schema, env vars, Stripe catalog, provider webhooks.
5. Re-enable entitlements and run product test suite from archive.
