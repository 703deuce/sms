# Voice V2 after-hours hardening report

**Audit date:** 2026-09-16  
**Branch:** `cursor/voice-v2-hardening-2304`  
**Base stack:** qualification → knowledge → Calendly → send-link (Voice V2 receptionist)  
**Deployed SHA:** Not deployed from this pass (local commit only; Coolify/PSTN pending)  
**Product contract:** `docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md` (updated for duplicate matrix rows)

This document is an audit record only — not a second architecture source of truth.

---

## Scope

Hardening / integration / bug-hunt only. No new product features. No SMS expansion beyond existing booking-link and business-notification paths.

---

## Bugs found and fixed (this pass)

| Severity | Issue | Root cause | Fix |
|----------|--------|------------|-----|
| P1 | Qualification (and partial knowledge) capability flags could be lost on L2 ↔ payload sync | `VoiceV2ContextCapabilities` and `legacy-bridge` / warmup only pinned knowledge, not qualification | Extended `VoiceV2ContextCapabilities`; added `capability-pin.ts`; unified warmup + `syncLegacyFromRecord` |
| P2 | Contract matrix listed RESCHEDULE/CANCEL twice with conflicting statuses | Stale rows after Microsoft reschedule/cancel shipped | Removed duplicate NOT_STARTED rows; clarified SMS row |

---

## Headless regression results

All passed with `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs'`:

- `test-voice-v2-workflow-capability-headless.ts`
- `test-voice-v2-one-amy-headless.ts`
- `test-voice-v2-hardening-headless.ts` (new)
- `test-voice-v2-knowledge-headless.ts`
- `test-voice-v2-qualification-headless.ts`
- `test-voice-v2-calendly-headless.ts`
- `test-voice-v2-send-link-headless.ts`
- `test-voice-v2-request-only-headless.ts`
- `test-voice-v2-custom-intake-headless.ts`
- `test-voice-v2-scheduling-preference-headless.ts`
- `test-voice-v2-appointment-changes-headless.ts`
- `test-voice-v2-call-context-2a.ts`

Not re-run in this pass (unchanged paths): book-offered-slot mock/headless, booking-transition, call-warmup phase-2b, phase-2b hot-path, email-intake, certify known-good baseline (requires live Microsoft).

---

## Production UI wizard audit

**Status:** Not executed end-to-end in Cloud Agent VM (no authenticated production/staging wizard session). Acceptance for wizard save/publish/runtime remains **code-traced + headless publish bridge tests** until a human runs the 8-page UI sweep on the designated test agent/DID.

| Page (id) | Route context | Save path | Publish compiler | Runtime consumer | Pass/Fail | Fix |
|-----------|---------------|-----------|----------------|------------------|-----------|-----|
| Goals | `/solutions/ai-call-handling/appointment-assistant/setup` | `POST /api/solutions/appointment-receptionist` | `mergeAppointmentWizardAdvanced` | `context-build` / Telnyx workflow | TRACE | — |
| Phone | same | same | phone + routing metadata | ingress / number assignment | TRACE | — |
| Information | same | same | `knowledge`, FAQ items | prompt Layer B + optional RAG | TRACE | — |
| Appointments | same | same | `bookingStrategy`, qual, Calendly | tools + gates | TRACE | — |
| Call handling | same | same | behaviors / fallbacks (partial) | prompt + tools | TRACE | — |
| Voice | same | same | voice selection | Telnyx assistant | TRACE | — |
| Test | same | same | diagnostics | test APIs | TRACE | — |
| Activate | same | `publishVoiceAgent` + Telnyx sync | pinned revision | new calls | TRACE | — |

---

## Capability inventory (implemented vs not)

| Area | Status | Notes |
|------|--------|-------|
| ONE_AMY | HEADLESS + prior PSTN | No LIVE_BOOKING node in one-Amy mode |
| Wizard 8-page | IMPLEMENTED | UI certification pending |
| Mode matrix NONE / REQUEST_ONLY / SEND_LINK / MICROSOFT_365 / CALENDLY | HEADLESS | Hardening script asserts FIND/BOOK leakage |
| Knowledge / RAG | HEADLESS | Composable; tool only when enabled + KB ids |
| Qualification | HEADLESS | Gate on FIND/BOOK/send-link |
| Microsoft FIND/BOOK | Frozen + HEADLESS partial | PSTN certified historically |
| Reschedule / cancel (Microsoft) | HEADLESS (`appointment-changes`) | PSTN pending |
| Calendly live booking | HEADLESS | PSTN pending |
| Transfer / warm / waterfall / urgency | NOT_STARTED | No runtime in `voice-v2` for urgency/transfer |
| Callback preference (dedicated) | PARTIAL | Intake/message flows; no dedicated callback product slice |
| Business notifications | PARTIAL | Verify on PSTN |

---

## Remaining known issues (require PSTN or production UI)

1. Full 8-page wizard save → refresh → publish → next-call behavior on a real test agent (mode switch BI in prompt).
2. Microsoft FIND/BOOK PSTN recert after qualification/knowledge composition.
3. Calendly PSTN with paid test account.
4. SEND_LINK SMS acceptance on real handset.
5. Warm/waterfall/transfer stack not built — do not test until implemented.
6. Latency buckets (caller-perceived) not measured in this pass.
7. Random custom field PSTN (`mothers_name`, etc.) — headless custom intake passes; PSTN pending.
8. MCTB vs Voice Agent DID ownership — prior UI work; re-verify on assign/save in production.

---

## Coolify / health

Not run from this environment. After merge/deploy: confirm `/api/health` SHA matches git push per `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`.

---

## PSTN tests still required (minimum)

1. **Composition call (Microsoft):** multi-field + FAQ + preference + correction + FIND + BOOK + secondary callback request.  
2. **Transfer call:** only after transfer capabilities ship.  
3. **Failure fallback call:** transfer exhaustion → message/callback.  
4. **Mode switch:** MICROSOFT_365 → REQUEST_ONLY → MICROSOFT_365 via wizard publish, two new calls.

---

*End of hardening report*
