# Voice V2 — Pre-manual regression record

**Date:** 2026-09-16  
**Branch:** `cursor/voice-v2-pre-manual-regression-2304`  
**Scope:** Connected Voice V2 backend only — no Playwright, no PSTN.  
**Product contract:** `docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md`, `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`

## Summary

| Metric | Value |
|--------|-------|
| Headless scripts run | 24 |
| Pass | 24 |
| Fail (before fix) | 1 (`test-voice-v2-booking-transition-headless.ts`) |
| Code bugs in runtime | 0 |
| Test harness fix | Pin `MICROSOFT_365` + `voiceV2PstnLiveBooking` in booking-transition seed (DB strategy was `REQUEST_ONLY`) |
| Production `/api/health` SHA | `bd5dc547ab686f3ae1bc0c48a7ab95d3cb66aeab` |
| 571 line (`…3615`) | `VOICE_AGENT` → TeXML `3049047658506225103` → assistant `assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6` |
| Ready for manual UI + PSTN | **YES** (backend) |

---

## Capability matrix

| CAPABILITY | TESTS RUN | PASS/FAIL | BUG FOUND | FIX | RETEST | STATUS |
|------------|-----------|-----------|-----------|-----|--------|--------|
| One Amy | `test-voice-v2-one-amy-headless.ts` | PASS | — | — | — | OK |
| Wizard config / publish bridge | `test-wizard-advanced-bridge.ts`, `test-wizard-merge-on-save.ts`, `test-voice-v2-wizard-booking-strategies.ts` | PASS | — | — | — | OK |
| Generic intake + custom fields | `test-voice-v2-custom-intake-headless.ts`, `test-voice-v2-step1-intake-headless.ts`, `test-voice-v2-email-intake.ts` | PASS | — | — | — | OK |
| Multi-field capture | `test-voice-v2-custom-intake-headless.ts` | PASS | — | — | — | OK |
| No-reask / known state | `test-voice-v2-hardening-headless.ts`, `test-voice-v2-custom-intake-headless.ts` | PASS | — | — | — | OK |
| Correction / latest wins | `test-voice-v2-custom-intake-headless.ts`, `test-voice-v2-scheduling-preference-headless.ts` | PASS | — | — | — | OK |
| Scheduling preference memory | `test-voice-v2-scheduling-preference-headless.ts`, `test-voice-v2-booking-transition-headless.ts` | PASS | Test expected Microsoft path without pinned strategy | Pin capabilities in `seedCtx`; `booking_intent_active` on Call1 regression | PASS | OK |
| NONE / message only | `test-voice-v2-wizard-booking-strategies.ts`, `test-voice-v2-request-only-headless.ts` (NONE tools) | PASS | — | — | — | OK |
| REQUEST_ONLY | `test-voice-v2-request-only-headless.ts` | PASS | — | — | — | OK |
| SEND_LINK | `test-voice-v2-send-link-headless.ts` | PASS | — | — | — | OK |
| MICROSOFT FIND/BOOK | `test-voice-v2-book-offered-slot-mock-headless.ts`, `test-voice-v2-book-offered-slot-headless.ts`, `test-voice-v2-booking-transition-headless.ts` | PASS | — | — | — | OK |
| Microsoft timezone | `test-microsoft-graph-datetime-serialization.ts` | PASS | — | — | — | OK |
| Microsoft reschedule/cancel | `test-voice-v2-appointment-changes-headless.ts` | PASS | — | — | — | OK |
| Calendly | `test-voice-v2-calendly-headless.ts` | PASS | — | — | — | OK |
| Knowledge / RAG | `test-voice-v2-knowledge-headless.ts` | PASS | — | — | — | OK |
| Qualification + capability pin | `test-voice-v2-qualification-headless.ts`, `test-voice-v2-hardening-headless.ts` | PASS | — | — | — | OK |
| Layer B / business knowledge | `test-voice-v2-knowledge-headless.ts`, `test-voice-v2-hardening-headless.ts` | PASS | — | — | — | OK |
| CallContext L1/L2 | `test-voice-v2-call-context-2a.ts` | PASS | — | — | — | OK |
| Config pinning / workflow capabilities | `test-voice-v2-workflow-capability-headless.ts`, `test-voice-v2-hardening-headless.ts` | PASS | — | — | — | OK |
| Wizard merge on save | `test-wizard-merge-on-save.ts` | PASS | — | — | — | OK |
| Voice / recording / publish path | `test-wizard-advanced-bridge.ts`, `test-mctb-wizard-skip-livekit.ts` | PASS | — | — | — | OK |
| Routing (571) | `wizard-571-voice-line-api-setup.mjs` (read-only verify) | PASS | — | — | — | OK |
| Business notifications (partial) | Code audit `business-request-notifications.ts` + outcome keys in `test-voice-v2-outcomes-postcall-headless.ts` | PASS | — | — | — | OK (idempotency keys; no live email/SMS) |
| Structured outcomes / summary | `test-voice-v2-outcomes-postcall-headless.ts`, strategy headless suites | PASS | — | — | — | OK |
| Transcript / post-call reconcile | `test-voice-v2-outcomes-postcall-headless.ts` (`postcall-reconcile` pure) | PASS | — | — | — | OK (no full DB e2e) |
| Provider mode isolation | `test-voice-v2-hardening-headless.ts`, per-strategy scripts | PASS | — | — | — | OK |
| Composition A–I | Covered by hardening matrix + strategy scripts + scheduling/custom intake | PASS | — | — | — | OK |
| Transfer / urgency (NOT_STARTED) | Not built; legacy isolated in wizard UI | N/A | — | — | — | Out of scope |

---

## Scripts executed (full list)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/<script>.ts
```

1. `test-voice-v2-one-amy-headless.ts`
2. `test-voice-v2-workflow-capability-headless.ts`
3. `test-voice-v2-hardening-headless.ts`
4. `test-voice-v2-custom-intake-headless.ts`
5. `test-voice-v2-scheduling-preference-headless.ts`
6. `test-voice-v2-request-only-headless.ts`
7. `test-voice-v2-send-link-headless.ts`
8. `test-voice-v2-calendly-headless.ts`
9. `test-voice-v2-knowledge-headless.ts`
10. `test-voice-v2-qualification-headless.ts`
11. `test-voice-v2-appointment-changes-headless.ts`
12. `test-voice-v2-call-context-2a.ts`
13. `test-voice-v2-wizard-booking-strategies.ts`
14. `test-wizard-advanced-bridge.ts`
15. `test-wizard-merge-on-save.ts`
16. `test-mctb-wizard-skip-livekit.ts`
17. `test-voice-v2-booking-transition-headless.ts`
18. `test-voice-v2-book-offered-slot-mock-headless.ts`
19. `test-voice-v2-book-offered-slot-headless.ts`
20. `test-voice-v2-step1-intake-headless.ts`
21. `test-voice-v2-email-intake.ts`
22. `test-microsoft-graph-datetime-serialization.ts`
23. `test-voice-v2-outcomes-postcall-headless.ts`
24. `wizard-571-voice-line-api-setup.mjs` (verify only; requires `BASE_URL`, `PHONE_E164`)

---

## One-Amy assertions (from one-amy headless)

- `GENERAL_TO_BOOKING_EDGE_COUNT = 0`
- `LIVE_BOOKING_NODE_COUNT = 0`
- No second scheduling LLM / legacy booking router on PSTN path

---

## False-success / idempotency

- Microsoft BOOK / reschedule / cancel: `test-voice-v2-appointment-changes-headless.ts`, mock book slot tests
- Calendly: `test-voice-v2-calendly-headless.ts`
- Send link: `test-voice-v2-send-link-headless.ts`
- No runtime code changes required in this pass

---

## Deploy

No production deploy required for test-only harness fix unless this branch is merged; runtime on production already at `bd5dc547`.

---

## Next step (human)

Manual wizard UI walkthrough + single PSTN smoke on `+1…3615` per user checklist.
