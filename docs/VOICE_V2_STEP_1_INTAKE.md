# Voice V2 — Step 1 (production intake)

**Authority:** User directive 2026-09-15. Implementation must preserve `VOICE_V2_KNOWN_GOOD_BASELINE` (`06125f5f` runtime).

See `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md` for frozen FIND/BOOK behavior.

## Architecture summary

- One agent (Amy), full live transcript, structured session state as action authority.
- `voice_v2_save_intake_fields` only — fast in-memory update, async durable persist.
- `getIntakeReadiness()` — deterministic pre-book gate on **BOOK only** (not FIND).
- Linkage/CRM/audit — observer after success (not Step 1 blocker).

Certify: `npx tsx scripts/test-voice-v2-step1-intake-headless.ts`
