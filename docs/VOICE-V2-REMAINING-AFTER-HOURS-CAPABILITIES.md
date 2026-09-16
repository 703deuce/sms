# Voice V2 — remaining after-hours capabilities (implementation record)

**Date:** 2026-09-16  
**Branch:** `cursor/voice-v2-after-hours-handling-2304`  
**Authority:** `docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md`

## Summary

One shared **after-hours handling layer** on One-Amy Voice V2: urgency, transfer (basic/warm/waterfall), callback, fallbacks, customer status, spam/solicitation. Wizard Call Handling + publish compiler `voiceV2AfterHoursHandling`.

| CAPABILITY | WIZARD | PERSISTED | PUBLISHED | RUNTIME | HEADLESS TEST | STATUS |
|------------|--------|-----------|-----------|---------|---------------|--------|
| Urgency | Call Handling toggles + rules (schema) | `urgencyEnabled`, `urgencyRules` | `advanced.voiceV2AfterHoursHandling` | `urgency-evaluator`, `after-hours-orchestrator` | `test-voice-v2-after-hours-handling-headless.ts` | HEADLESS_CERTIFIED |
| Basic transfer | Destinations + enable V2 transfer | `transferDestination*`, `voiceV2HumanTransferEnabled` | same | `transfer-executor`, `transfer-call` API | same | HEADLESS_CERTIFIED (BASIC Telnyx) |
| Warm transfer | `warmTransfer` + step mode | plan steps | same | `warm-briefing`, provider WARM=stub | same | IMPLEMENTED (PSTN pending) |
| Waterfall | `transferRouting=waterfall` | `transferPlanSteps` | same | sequential executor | same | HEADLESS_CERTIFIED |
| Callback | Call Handling toggles | `callbackRequestsEnabled`, etc. | same | `callback-request`, API | same | HEADLESS_CERTIFIED |
| Fallbacks | `transferFallback` | mapped to canonical | same | `fallback-resolver` | same | HEADLESS_CERTIFIED |
| Customer status | Appointments `distinguishNewExisting` | `customer_status` field | intake schema | intake + rules | partial in suite | IMPLEMENTED |
| Spam / solicitation | Call Handling toggle | `salesSolicitation*` | same | `spam-handling` | same | HEADLESS_CERTIFIED |

## Known limitations

- Warm transfer PSTN: consultation leg + Press-1 bridge not fully wired to Telnyx warm APIs in production route (BASIC cold transfer uses `transferCall`).
- Urgency rule UI: toggles only in wizard; full rule builder reuses qualification pattern — add rules via state/API for now.
- Transfer API route uses live Telnyx provider for BASIC; headless tests use `MockVoiceV2TransferProvider` directly.

## Tests

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-after-hours-handling-headless.ts
```

Plus existing Voice V2 regression suite (one-amy, hardening, merge, booking-transition, etc.).
