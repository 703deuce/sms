# Voice V3 — master feature & certification checklist

Copy-friendly checklist consolidating the V3 “everything we need” lists from governing docs.  
Mark each row: **PASS** | **FAIL** | **NOT RUN** | **N/A**.

**Primary sources**

- `docs/VOICE-V3-PRODUCTION-AGENT-COMPLETION-REPORT.md` — tools & architecture
- `docs/VOICE-V3-LIVEKIT-IMPLEMENTATION-DIRECTIVE.md` — LiveKit migration phases 41–56, PSTN A–J
- `docs/VOICE-V3-LIVEKIT-MIGRATION-DIRECTIVE.md` — intake A–J, test matrices
- `docs/VOICE-V3-AGENT-FOUNDATION-AUDIT.md` — foundation + PSTN §51 A–E
- `docs/VOICE-V3-CALLBACK-PSTN-CERT-REPORT.md` — callback PSTN A/B
- `docs/VOICE-V3-SEND-LINK-FREEZE-GATE.md` — SEND_LINK freeze
- `docs/voice-v3/PRODUCTION-DEPLOY-CHECKLIST.md` — deploy / env / log sequence
- `src/lib/voice-v3/tools/voice-tool-catalog.ts` — canonical tool surface

**Cert line (typical):** `+15717491060` · workspace `ws_1` · agent `cmshz2lc25c622c4i58303501`

---

## 1. Runtime & plumbing (LiveKit path)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | Telnyx PSTN → LiveKit Cloud SIP (not stale OpenAI-only ingress on cert DID) | | |
| 1.2 | Dispatch rule → `transovo-voice-v3` worker | | |
| 1.3 | `GPTLiveModel` + `delegation="responses"` (no manual sideband coordinator on LiveKit path) | | |
| 1.4 | Web: `resolve_voice_v3_livekit_session` deployed (not `Unknown action`) | | |
| 1.5 | Voice worker: `TransovoBackend` stays open until job shutdown (not closed right after `session.start`) | | |
| 1.6 | Caller utterance commit + tool execute over internal API | | |
| 1.7 | **Proactive greeting on answer** (`generate_reply` / `initialGreetingText` when `speaksFirst=ai`) | | |
| 1.8 | Rollback boundary documented (`docs/VOICE-V3-LIVEKIT-CUTOVER-STATE.md`) | | |

---

## 2. Wizard → published config → runtime

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Draft vs publish; activation checklist | | |
| 2.2 | `compileVoiceV3AgentConfig` — booking strategy, capabilities, intake fields | | |
| 2.3 | Live instructions (Amy) + Astra backend instructions | | |
| 2.4 | Tool catalog matches wizard capabilities (no ghost tools) | | |
| 2.5 | Dynamic intake function tools per published fields | | |
| 2.6 | `speaksFirst` + `openingGreeting` honored at runtime | | |
| 2.7 | Live voice id / telephony fields propagated | | |

---

## 3. Tool surface (catalog — enable per strategy)

| Tool | Kind | Microsoft direct | SEND_LINK | Callback-capable |
|------|------|------------------|-----------|------------------|
| `update_intake` | state | ✓ | ✓ | ✓ |
| `set_scheduling_preference` | state | ✓ | — | — |
| `find_availability` | read | ✓ | — | — |
| `book_appointment` | mutation | ✓ | — | — |
| `find_appointment` | read | ✓ | — | — |
| `reschedule_appointment` | mutation | ✓ | — | — |
| `cancel_appointment` | mutation | ✓ | — | — |
| `send_booking_link` | mutation | — | ✓ | — |
| `request_callback` | mutation | if enabled | if enabled | ✓ |
| `transfer_call` | lifecycle | if destinations | if destinations | if destinations |
| `end_call` | lifecycle | ✓ (LiveKit native) | ✓ | ✓ |

Per-tool cert (each enabled tool): wizard on → exposed to Astra → LiveKit invokes → args valid → Transovo auth → provider/DB effect → structured result → Amy speaks truthfully.

---

## 4. Intake objective (continuous) — Tests A–J

| ID | Scenario | Status |
|----|----------|--------|
| A | All intake fields in one utterance | |
| B | Name early, book later | |
| C | Partial early, book later — only missing fields asked | |
| D | Custom field early, required later — satisfied | |
| E | Email correction | |
| F | Multi-field correction | |
| G | Booking → callback reuse | |
| H | Callback → booking reuse | |
| I | Missing email — active collection only when needed | |
| J | Q&A only — no unnecessary interrogation | |

**Scripts:** `scripts/test-voice-v3-intake-objective.ts`, `test-voice-v3-closed-loop-intake-multiturn.ts`

---

## 5. Pre–LiveKit-cutover automated flows (Phase 41)

| # | Flow | Status |
|---|------|--------|
| 5.1 | Straight callback | |
| 5.2 | Straight availability / FIND | |
| 5.3 | Booking → callback during FIND | |
| 5.4 | Callback → booking | |
| 5.5 | Monday → Tuesday (or equivalent) during FIND | |
| 5.6 | Rapid corrections (no keyword router) | |

---

## 6. Tool-loop switching (booking ↔ callback ↔ scheduling)

| # | Scenario | Status |
|---|----------|--------|
| 6.1 | BOOKING ↔ CALLBACK at each phase | |
| 6.2 | Day preference change before / during / after FIND | |
| 6.3 | FIND_APPOINTMENT → CALLBACK | |
| 6.4 | Mid-call pivot without duplicate SMS/book side effects | |

---

## 7. Microsoft appointment management

| # | Item | Status |
|---|------|--------|
| 7.1 | New book → Graph event created | |
| 7.2 | Find existing (DB + manual calendar discovery) | |
| 7.3 | Reschedule (OfferSet, PATCH, same `providerEventId`) | |
| 7.4 | Cancel (`confirmed=true`, idempotent) | |
| 7.5 | Stale OfferSet / correction during FIND | |
| 7.6 | OUTCOME_UNKNOWN readback / reconcile | |
| 7.7 | BOOK regression unchanged after cancel/reschedule work | |

**Scripts:** `npm run test:voice-v3-booking`, `test-voice-v3-microsoft-appointment-management.ts`, `cert-voice-v3-microsoft-appointment-live.ts` (live)

---

## 8. SEND_LINK (booking link SMS)

| # | Item | Status |
|---|------|--------|
| 8.1 | Strategy `SEND_LINK` only exposes link tools (no `book_appointment` / FIND) | |
| 8.2 | URL/sender not model-supplied; consent gate | |
| 8.3 | SMS delivered via existing executor (sync path OK) | |
| 8.4 | Automated matrix PASS (`test-voice-v3-send-booking-link-matrix.ts`) | |
| 8.5 | **PSTN:** ask to book → link SMS received | |
| 8.6 | Freeze gate four criteria (`docs/VOICE-V3-SEND-LINK-FREEZE-GATE.md`) | |

---

## 9. Request callback

| # | Item | Status |
|---|------|--------|
| 9.1 | `request_callback` in catalog when enabled | |
| 9.2 | Required fields: name, phone, service reason (per config) | |
| 9.3 | `CallbackRequest` row + `VOICE_V3` metadata | |
| 9.4 | No bogus `book_appointment` / SEND_LINK on callback-only call | |
| 9.5 | **PSTN A** — direct callback | |
| 9.6 | **PSTN B** — booking / link flow → pivot to callback | |
| 9.7 | Callback **FROZEN** (after A+B evidence in cert report) | |

**Inspect:** `scripts/inspect-voice-v3-callback-pstn-cert.ts`

---

## 10. Transfer & end call

| # | Item | Status |
|---|------|--------|
| 10.1 | `transfer_call` — authorized destination only | |
| 10.2 | LiveKit `TransferSIPParticipant` + correct participant identity | |
| 10.3 | Cold transfer ends session; failure keeps Amy | |
| 10.4 | Straight transfer; booking → transfer; callback → transfer | |
| 10.5 | `end_call` / EndCallTool — hangup + room teardown | |

---

## 11. LiveKit PSTN certification calls A–J (Phase 54)

Run on cert DID after web + voice deploy. Log boundary **A–L** on first failure.

| Call | Scenario | Status |
|------|----------|--------|
| A | Straight callback | |
| B | Booking or scheduling → callback pivot | |
| C | Callback → booking / scheduling | |
| D | Day change during FIND (e.g. Monday → Tuesday) | |
| E | Microsoft **book** (full PSTN) | |
| F | Microsoft **find appointment** | |
| G | Microsoft **reschedule** | |
| H | Microsoft **cancel** | |
| I | **SEND_LINK** — voice consent → SMS link | |
| J | **Transfer** + **greeting/silence** (AI speaks first without caller hello) | |

---

## 12. Agent foundation PSTN (§51 A–E)

Manual after deploy; see `docs/VOICE-V3-AGENT-FOUNDATION-AUDIT.md`.

| ID | Item | Status |
|----|------|--------|
| A | | |
| B | | |
| C | | |
| D | | |
| E | | |

*(Fill from your runbook / timeline inspection — foundation automated suites already PASS in repo.)*

---

## 13. Conversation freshness & delegation (regression)

| # | Item | Status |
|---|------|--------|
| 13.1 | No `response.create` before function outputs closed | |
| 13.2 | Turn revision / stale read ignored | |
| 13.3 | Amy re-delegation after tool results | |
| 13.4 | Multi-goal / operation switching without keyword router | |

**Scripts:** `test-voice-v3-conversation-freshness-matrix.ts`, `test-voice-v3-delegation-protocol-race.ts`

---

## 14. Concurrency torture matrix (Phase 48 — sample)

Do **not** mark V3 LiveKit certified on “happy path book” only.

| Category | Examples to exercise |
|----------|----------------------|
| Interruption | Caller talks over Amy; during READ; during WRITE |
| Duplicate / cancel | Duplicate READ/WRITE; LiveKit duplicate policy + Transovo idempotency both kept |
| Timeouts | Provider timeout; backend timeout; success lost on HTTP |
| Hangup | During READ/WRITE; SIP disconnect |
| Objective change | During FIND; before/after WRITE commit |
| Errors | Malformed args; needs_information loop; OpenAI error |

**Script:** `scripts/test-voice-v3-livekit-concurrency-cert.ts` (where applicable)

---

## 15. Production deploy smoke (one call)

From `docs/voice-v3/PRODUCTION-DEPLOY-CHECKLIST.md`:

| Step | Expected log / behavior | Status |
|------|-------------------------|--------|
| 1 | Inbound on V3 / LiveKit path (not TeXML Amy for receptionist) | |
| 2 | Session resolve + runtime created | |
| 3 | Greeting audio without waiting for caller | |
| 4 | Intake + rules evaluated | |
| 5 | Tool path matches strategy (FIND/BOOK / SEND_LINK / callback) | |
| 6 | No Voice V2 / `ai_assistant_start` on receptionist call | |

---

## 16. Automated gate (run before merge / deploy)

```bash
npm run test:voice-v3-agent
npm run test:voice-v3-recovery
npm run test:voice-v3-intake
npm run test:voice-v3-availability
npm run test:voice-v3-booking
npm run test:voice-v3-cancellation
npm run test:voice-v3-reschedule
npm run test:voice-v3-prompts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-architecture-invariants.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-livekit-bridge.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-send-booking-link-matrix.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-matrix.ts
```

---

## 17. Sign-off

| Gate | Status | Date | SHA / deploy |
|------|--------|------|--------------|
| `VOICE_V3_LIVEKIT_PSTN_CERTIFIED` (directive Phase 55) | | | |
| SEND_LINK frozen | | | |
| Callback frozen | | | |
| Microsoft live matrix (manual A–J if used) | | | |

---

*Last consolidated: 2026-09-20. Update this file when cert evidence lands in the specific reports above.*
