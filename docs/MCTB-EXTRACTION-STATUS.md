# MCTB-Only Extraction — Work In Progress

Branch: `cleanup/mctb-only-production`

## Completed

- Safety snapshot: tag `pre-mctb-extraction-2026-08-25`, branch `archive/pre-mctb-extraction-2026-08-25`
- Product inventory: `docs/PRODUCT-CODE-INVENTORY.md`
- Archive: 996 paths copied locally, commit `719c3d9` (GitHub push blocked — needs repo write access)
- Removed dormant UI routes, APIs, and ~996 product files from production
- MCTB-only navigation (`voice-nav.ts`, `app-shell`, `sidebar`)
- MCTB job handler slim-down
- Docs: `docs/ARCHIVED-PRODUCTS.md`

## Blocked / In progress

- **Archive push:** `403` — grant `cursor[bot]` write access to `703deuce/smsarchive` or push manually from `/tmp/transovo-archive`
- **Production build:** shared runtime dependencies (smart-routing consent, phone voicemail, solutions save, voice webhooks) still being reconciled
- **Typecheck:** ~90 files with transitive imports to archived modules

## MCTB shared runtime (intentionally kept)

Press-1 consent and Telnyx ingress use `lib/smart-routing/` consent/media modules — not the Smart Routing product UI.
