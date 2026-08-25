# MCTB-Only Extraction — Status

Branch: `cursor/mctb-only-production-9cca`  
PR: https://github.com/703deuce/sms/pull/256

## Approach

**Pragmatic rule:** remove only code that does **not** touch MCTB at all. Shared libraries on the MCTB telephony/SMS/consent import chain stay in production even if they also served other products.

## Completed

| Item | Status |
|------|--------|
| Safety snapshot | tag `pre-mctb-extraction-2026-08-25` |
| Archive remote | **VERIFIED** — `smsarchive@main` = `81f06c16` |
| Dormant product routes/pages/APIs removed | ~996 paths |
| MCTB core preserved | 125 files in `lib/mctb`, agent, solutions |
| MCTB-only customer nav | `voice-nav.ts` |
| Static route verification | `scripts/verify-mctb-extraction.mjs` |
| Production route manifest | `docs/PRODUCTION-ROUTE-MANIFEST.md` |

## MCTB core integrity check

Compared to safety tag `pre-mctb-extraction-2026-08-25`:

- **Zero deletions** in `src/lib/mctb/`, `src/lib/agents/missed-call-text-back/`, `src/lib/solutions/missed-call-text-back/`, or MCTB API routes
- Only change: `src/lib/mctb/dashboard-types.ts` (+1 line)
- Deleted voice pages are **non-MCTB** products (agents, receptionist, campaigns, voicemail product UI, etc.)

## Validation (2026-08-25)

| Check | Result |
|-------|--------|
| `npm run build` | **PASS** |
| `node scripts/verify-mctb-extraction.mjs` | **PASS** |
| `npm run test:mctb-try-it-ux` | **PASS** (9/9) |
| `npm run test:mctb-consent-log` | **PASS** |
| `npm run test:transovo-platform` | **PASS** |
| `npm run test:mctb-call-control-handler` | **PASS** |
| `npm run test:mctb-sip-ingress-send-gate` | **PASS** |
| `npm run test:mctb-event-only` | **PASS** |
| `npm run test:mctb-voice-bridge` | **PASS** |
| `npm run test:mctb-sip-event-only` | **PASS** |
| `npm run test:mctb-admin-setup` | **PASS** (with server-only preload) |
| `npm run test:mctb-demo-call-detect` | **PASS** (test aligned to ingress semantics) |

## Removed (bulk prune 2026-08-25)

- **631 unreachable files** deleted via `scripts/prune-non-mctb.mjs` (whole files only — no in-file trimming)
- General Caller Amy webhook: `/api/telnyx/voice` (MCTB uses dedicated `mctb-*` routes)
- Non-MCTB voice jobs removed from `job-handlers` (`voice_webhook_process`, `voice_post_call`, `voice_webhook_dlq_reprocess`)
- Twilio voice webhooks (non-MCTB), generic `/api/voice/*` conversation APIs

Protected from prune (always kept): `lib/mctb/`, `lib/agents/missed-call-text-back/`, `lib/solutions/missed-call-text-back/`, `lib/smart-routing/` runtime

## Removed (earlier passes)

- `voice-runtime/` — LiveKit AI receptionist worker
- Non-MCTB `python-runtime-bridge/*` handlers
- Off-chain realtor/outbound/real-estate compile code
- Customer-facing dormant product routes (see `PRODUCTION-ROUTE-MANIFEST.md`)

## Merge readiness

| Gate | Status |
|------|--------|
| Archive remote verified | **YES** |
| Build passes | **YES** |
| MCTB core not deleted | **YES** |
| MCTB unit/integration tests | **YES** |
| Live PSTN smoke documented | **Pending** (post-merge ops) |
| Safe to merge | **Ready for review** — recommend human sign-off after staging deploy |

## Out of scope (do not touch in this workstream)

- Hetzner / `voice.transovo.ai` self-hosted LiveKit
- `smsarchive` content (read-only reference)
- LiveKit Cloud voice routing unless MCTB SMS path requires it
