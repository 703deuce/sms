# MCTB-Only Extraction — Status

Branch: `cursor/mctb-only-production-9cca`

## Approach (revised)

**Pragmatic rule:** remove only code that does **not** touch MCTB at all. Shared libraries that MCTB's telephony/SMS/consent path imports are **kept in production** even if they also served other products. Customer-facing routes/pages for dormant products stay removed.

## Completed

- Safety snapshot: tag `pre-mctb-extraction-2026-08-25`
- Archive: 996 paths locally at commit `719c3d9` (remote push blocked)
- Dormant product **routes/pages/APIs** removed from production
- MCTB-only customer navigation
- Shared runtime kept where MCTB import chain requires it

## Validation (latest)

| Check | Result |
|-------|--------|
| `npm run build` | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| `npm run test:mctb-try-it-ux` | **PASS** |
| `npm run test:transovo-platform` | **PASS** |
| `npm run test:mctb-consent-log` | **PASS** |

## Removed (non-MCTB only)

- `voice-runtime/` — LiveKit AI receptionist worker (no MCTB imports)
- Non-MCTB `python-runtime-bridge/*` booking/telemetry handlers (internal API route already gone)
- Orphaned test scripts for deleted bridge modules

## Still needed

- Push archive to `smsarchive` (repo write access)
- Legacy route 404 probing
- Broader MCTB test matrix + browser smoke
- `docs/PRODUCTION-ROUTE-MANIFEST.md`
