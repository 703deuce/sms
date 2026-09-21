# Voice V3 — restore/reconnect pre-deployment report

**Date:** 2026-09-21  
**Branch:** `cursor/voice-v3-restore-reconnect-2304`  
**Status:** STOP BEFORE PRODUCTION DEPLOYMENT (per directive)

This pass treats the reuse audit as authoritative: **restore/port proven V3 code onto current master**, not greenfield implementation.

---

## Executive summary

| Phase | Scope | Status this pass |
|-------|--------|------------------|
| **1** | Booking persistence after `BOOKING_CONFIRMED` | **Implemented + tested** |
| **2** | Qualification / urgency / REQUEST_ONLY (`d275f9c3`) | **Not wired** — requires `deterministic-rules` + call-context + compile deltas |
| **3** | 100-page website crawl + RAG (`55e48438`, `affb98c5`, `0ad68d4e`) | **Not ported** — Prisma + job handlers + UI bundle |
| **4** | Wizard → Live V3 config (`instructions.system`, publish fallback) | **Not changed** — audit only |
| **5** | Transfer alignment | **Not changed** — compile paths already present on master |
| **6** | Freshness (`markCallerTurnSemanticApplied`) | **Not wired** — hook point needs trace on current pipeline |
| **7** | Forensics enrichment | **Not changed** |
| **8** | SEND_LINK verification | **Not re-run** — master already has executor path |

---

## 1. Files added

| Path | Purpose |
|------|---------|
| `src/lib/voice-v3/calendar/persist-booking-after-confirmation.ts` | Provider-neutral Postgres persistence + `markVoiceCallBooked` + CRM hook |
| `scripts/test-voice-v3-booking-persistence.ts` | Idempotency + `appointmentBooked` flag test (requires `DATABASE_URL`) |
| `docs/VOICE-V3-RESTORE-RECONNECT-PRE-DEPLOYMENT-REPORT.md` | This report |
| `docs/VOICE-V3-PRE-FIND-DELEGATION-DELAY-FORENSICS-REPORT-2026-09-21.md` | Prior read-only SET→FIND delay forensics (separate task) |

---

## 2. Files modified

| Path | Change |
|------|--------|
| `src/lib/voice-v3/calendar/book-dispatch.ts` | After in-memory `registerDurableBooking`, async `persistVoiceV3BookingAfterConfirmation` |
| `src/lib/voice-v3/calendar/booking-types.ts` | `VoiceV3CalendarBookingProvider` = `microsoft` \| `google` on `ConfirmedBooking` (type only; MS commit path unchanged) |

**Not modified (confirmed):**

- `src/lib/voice-v3/calendar/google/**` — no Google provider execution changes
- Microsoft create booking executor / Graph commit path in `book-dispatch.ts`
- Intake, filler, delegation, SET→FIND behavior
- Python worker / GPT-Live orchestration

---

## 3. Historical files restored / ported (by originating SHA)

| SHA | Intended feature | This pass |
|-----|------------------|-----------|
| **(this branch)** | Booking persistence boundary | **New code** (pattern from `product-persist.ts`, `commit-booking-for-python.ts`, `markVoiceCallBooked`) |
| `d275f9c3` | Qualification, service policy, REQUEST_ONLY | **Not ported** — partial extract attempted; blocked on missing `deterministic-rules` on master and `verbalConfirmation` on call context |
| `55e48438` | Website crawl (`MAX_USEFUL_PAGES = 100`) | **Not ported** |
| `affb98c5` | Retrieval / compile knowledge hooks | **Not ported** |
| `0ad68d4e` | GPT-Live `file_search` connection | **Not ported** |

---

## 4. Booking persistence implementation

**Boundary:** existing `BOOKING_CONFIRMED` in `book-dispatch.ts` → `persistVoiceV3BookingAfterConfirmation` (async, non-blocking).

**Behavior:**

1. Provider calendar commit unchanged (Microsoft path only on master today).
2. Upsert `voice_appointments` by `workspaceId` + `externalId` (`microsoft:{eventId}` or `google:{eventId}` when provider is google).
3. Idempotent by `metadata.voiceV3.bookingAttemptId` + `callId` on retry.
4. Sets `callId`, `startsAt`/`endsAt`, `timezone`, `serviceName`, metadata: `provider`, `providerEventId`, `providerCalendarId`, `bookingAttemptId`, `offerSetId`, `slotId`, `schedulingGeneration`.
5. Calls `markVoiceCallBooked` → `appointmentBooked: true`, notification hook, trace.
6. Calls `syncFrontDeskBookingToCrm` when configured (same pattern as Python bridge).
7. Keeps `registerDurableBooking` in-memory store for same-call management.

**Does not** route through `src/lib/voice/calendar/booking.ts` (reference only).

---

## 5. Qualification / REQUEST_ONLY restoration

**Planned source:** `d275f9c3` — files such as:

- `src/lib/voice-v3/policy/service-policy.ts`
- `src/lib/voice-v3/policy/effective-tool-authorization.ts`
- `src/lib/voice-v3/qualification/evaluate-qualification.ts`
- `src/lib/voice-v3/urgency/evaluate-urgency.ts`
- `src/lib/voice-v3/appointment-request/*`
- `src/lib/voice-v3/tools/submit_appointment_request` (if present on branch)
- `call-rules.ts`, `compile-voice-v3-agent-config.ts`, `authorize-tool-for-config.ts` deltas

**Blocker on blind port:** `evaluate-qualification.ts` imports `@/lib/voice-receptionist-wizard/deterministic-rules` — **not present on current master**. Must port that dependency or re-home rules before wiring.

**Next step:** File-by-file diff `d275f9c3` vs `master` for the list above; wire `call-rules` only after `booking.verbalConfirmation` exists on `VoiceV3CallContext`.

---

## 6. Website crawler restoration

**Confirmed in repo history (`55e48438`):**

- `src/lib/voice-v3/knowledge/website-crawl/*` (`constants.ts` → `MAX_USEFUL_PAGES = 100`, `discover.ts`, `prioritize.ts`, …)
- API: `src/app/api/voice/knowledge/crawl/[jobId]/route.ts`
- Prisma migration in that commit (knowledge job models)
- `scripts/test-voice-v3-website-crawl.ts`

**Current master:** no `website-crawl` tree; knowledge hot summaries via wizard `knowledgeItems` in compile only.

**Next step:** Port lib + migration + job handler slice from `55e48438`, then `affb98c5` retrieval + `0ad68d4e` file_search — **no new crawler**.

---

## 7. RAG / runtime knowledge restoration

**Commits:** `affb98c5` (resolve-agent-knowledge-retrieval, backend instructions), `0ad68d4e` (GPT-Live file_search wiring).

**Next step:** Port onto current `compileVoiceV3AgentConfig` + existing `knowledge.retrieval` block; preserve hot-context summaries in `live-frontend-instructions.ts`.

---

## 8. Wizard → runtime mappings fixed

**Not changed this pass.**

**Known gap (audit):** `instructions.system` / approved business instructions vs demo env fallback — trace `resolveWizardSnapshotForVoiceV3` → `compileVoiceV3AgentConfig` → `session.py` / `live-frontend-instructions.ts`.

**Existing on master:** `from-published-agent.ts`, `resolve-wizard-snapshot-for-v3.ts`, compile for transfer/knowledge/services.

---

## 9. Transfer mappings fixed

**Not changed this pass.**

**Existing on master:** `transferDestinationsFromWizard`, `transferPlanSteps` in `compile-voice-v3-agent-config.ts`; Python `transfer_executor.py` warm/waterfall.

**Validation still owed:** E.164 normalization → non-empty runtime set; PSTN warm transfer cert (validation only).

---

## 10. Freshness wiring completed

**Not changed this pass.**

`markCallerTurnSemanticApplied` exists in `caller-turn-manager.ts` but is **not invoked** on the LiveKit worker path. Candidate: after successful semantic application in Node tool pipeline or `applyCallerMeaningToContext` completion — must preserve revision contract (`conversation-revision.ts`, stale FIND tests).

---

## 11. Forensics changes

**None.** Passive Python → Node ingest unchanged. Recommendation unchanged: enrich batch ingest with `bookingAttemptId`, provider ids on book events if product consumers need them; avoid sync DB in `FunctionTool`.

---

## 12. SEND_LINK verification / fixes

**Not re-certified this pass.** Master already has `send_booking_link`, `execute-send-booking-link`, compile `SEND_LINK` strategy. Manifest labels may still say “future” — doc-only fix deferred.

---

## 13. Tests run and results

| Test | Result |
|------|--------|
| `npx tsx scripts/test-voice-v3-booking.ts` | **PASS** |
| `npx tsx scripts/test-voice-v3-booking-persistence.ts` | **PASS** (creates/deletes test row; idempotency; `appointmentBooked`) |

**Not run:** qualification, website crawl, transfer matrix, freshness stale-FIND, send-link matrix, full `test:v1-production-readiness`.

---

## 14. Typecheck / build results

**Not run:** full `npm run build` (expensive; deferred per deploy discipline).

**Scoped:** booking module compiles in context of `test-voice-v3-booking.ts` execution.

---

## 15. Microsoft provider commit unchanged

**Yes.** No edits to `executeMicrosoftCreateBooking`, Graph create path, or Microsoft calendar modules.

---

## 16. Google provider commit unchanged

**Yes.** No edits under `src/lib/voice-v3/calendar/google/**`. `ConfirmedBooking.provider` type extended to include `google` for persistence only.

---

## 17. Old voice architecture not restored

**Yes.** No V2 Telnyx loop, sideband coordinator, or legacy `voice/calendar/booking.ts` routing.

---

## 18. Remaining genuine product gaps

1. **Phase 2–3 restore** (qualification/REQUEST_ONLY, website crawl + RAG) — port from SHAs with manual merge.
2. **Wizard `instructions.system`** + production vs demo config resolution.
3. **Freshness:** wire `markCallerTurnSemanticApplied`.
4. **Forensics:** optional delegation telemetry on all worker builds (see pre-FIND forensics report).
5. **Transfer:** PSTN warm certification, E.164 edge cases.
6. **SET→FIND latency** — OpenAI continuation turn variance (separate forensics; not in scope for this restore pass).

---

## 19. Commit SHA

_Pending git commit on branch `cursor/voice-v3-restore-reconnect-2304` — fill after push._

---

## Git discipline reminder

For `d275f9c3`, `55e48438`, `affb98c5`, `0ad68d4e`:

1. Inspect diff per file  
2. Compare to current master  
3. Port business logic only  
4. **Never** whole-commit cherry-pick (removes forensics, filler, Google, etc.)

---

*End of pre-deployment report.*
