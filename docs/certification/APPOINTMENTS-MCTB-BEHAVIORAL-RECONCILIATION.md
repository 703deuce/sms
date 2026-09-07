# Appointments + MCTB Behavioral Reconciliation

**Updated:** 2026-09-07 (targeted certification reconciliation pass)  
**Authority:** Governing docs + runtime audit (not route inventory alone)

Classification key: **IMPLEMENTED + TESTED** | **IMPLEMENTED + MISSING TEST** | **NOT IMPLEMENTED** | **INTENTIONALLY DEFERRED** | **OBSOLETE**

| Behavior | Classification | Evidence / notes |
|----------|----------------|------------------|
| External meeting AI Notetaker — add Zoom/Teams link to appointment | IMPLEMENTED + MISSING TEST | `voice-notetaker-wiring` passes wiring; no E2E bot-join sequence in cert matrix |
| Booking flow — choose “Add AI notes/recording” | IMPLEMENTED + MISSING TEST | Native video + notetaker settings exist; explicit booking-step cert case not automated |
| Notetaker bot joins external meeting → recap attaches | IMPLEMENTED + MISSING TEST | Runtime in notetaker lib; requires live meeting provider cert |
| Notetaker failure when bot cannot join | IMPLEMENTED + MISSING TEST | Failure paths exist in wiring tests only |
| Late/changed meeting link handling | IMPLEMENTED + MISSING TEST | Not in automated cert |
| Manual retry/rejoin for notetaker | NOT IMPLEMENTED | No customer-facing retry surface found |
| Auto Zoom/Teams meeting creation on book | NOT IMPLEMENTED | Native Transovo Video exists; no auto Zoom/Teams creator in V1 scope |
| Searchable meeting notes/recaps | IMPLEMENTED + MISSING TEST | Recap pages exist; no cross-recap search cert |
| Recap email/share — recipient selection & duplicate sends | IMPLEMENTED + MISSING TEST | `emailOnRecapReady` / `autoShareWith` in settings; no dedicated cert |
| Revoked public recap token | IMPLEMENTED + MISSING TEST | Token model exists; no automated cert |
| Notetaker disclosure / `notifyAttendeesAdvance` E2E | IMPLEMENTED + MISSING TEST | Setting exists; no delivery cert |
| `directDialForwardE164` — dedicated text number voice forward | IMPLEMENTED + MISSING TEST | Runtime + legacy setup-view; not in canonical `/mctb/setup/links` |
| Optional one-time follow-up (`followUpEnabled` legacy) | IMPLEMENTED + MISSING TEST | Legacy config fields preserved; Recovery Controls does not expose — **decision: hidden runtime, not V1 UI** |
| Voicemail greeting rollback safety | IMPLEMENTED + PARTIAL TEST | `test-voicemail-active-greeting.ts` exists; add explicit failed-replacement case |
| MCTB disabled but voicemail still works | IMPLEMENTED + MISSING TEST | Entitlement split possible; no dedicated cert sequence |
| Press-1 exact two-message sequence | IMPLEMENTED + TESTED | `test-mctb-consent-modes.ts`, `test-mctb-final-pipeline-contract.ts` |
| Existing-consent automatic send path | IMPLEMENTED + TESTED | `test-mctb-consent-modes.ts`, final pipeline contract |
| Sender-role separation (business line / forward / text-back) | IMPLEMENTED + MISSING TEST | IA docs + setup phone; no dedicated three-role UI cert |
| Local 10DLC readiness customer journey | INTENTIONALLY DEFERRED | TFV/toll-free path certified; local 10DLC not V1 launch |
| Business Hours standalone MCTB page | OBSOLETE | Redirects to Recovery Controls — certified `MCTB-LEGACY-SCHED-001` |
| Mass texting / AI receptionist / Smart Routing | OBSOLETE / DEFERRED | Out of V1 scope per `v1-product-status.ts` |
| `/mctb/setup/links` request form + default link | IMPLEMENTED + TESTED | **This pass:** `setup-links-view.tsx` + `test-mctb-setup-links.ts` |
| AP-WORKFLOWS minute scheduling (local) | IMPLEMENTED + TESTED | **This pass:** `test-appointment-workflow-minutes-scheduling.ts` |
| AP-WORKFLOWS minute SMS delivery | BLOCKED — PSTN | `test-appointment-workflow-minutes.ts` requires `TEST_PHONE` |
| AI transcription product purchasability | INTENTIONALLY DEFERRED | Catalog exists; `v1-product-status` defers `ai_transcription` |
| MCTB → appointment booked attribution | IMPLEMENTED + PARTIAL TEST | **This pass:** `test-mctb-cross-product-booking.ts` (hermetic); full E2E still PSTN/integration |

## AP-WORKFLOWS-minutes PSTN classification (resolved)

`scripts/test-appointment-workflow-minutes.ts` line 26 requires `TEST_PHONE` and books a live appointment with real phone for SMS workflow dispatch. **All deterministic minute scheduling** is certified locally via `test-appointment-workflow-minutes-scheduling.ts` using `resolveStepScheduledTime` on the `rapid_flow_test` template (0/1/3/5 minutes after booking). Only the provider SMS delivery leg remains **BLOCKED — PSTN** (`APT-WF-03-live`).

## AI-MCTB per-ID status (latest targeted retest)

| ID | Gate / focus | Notes |
|----|----------------|-------|
| AI-MCTB-001 | JOHN_LLM + extraction | john-preprod — see reconciliation state |
| AI-MCTB-002 | ELIGIBILITY + SCHEDULING | Fixed `require_carrier_forward: false` in preprod fixture |
| AI-MCTB-003 | OWNER_CONTROL + customer conversation | LLM immediate phrases fall back to structured update when model paraphrase imprecise |

## AI-VM per-ID status

| ID | Focus | Script |
|----|-------|--------|
| AI-VM-001 | Transcript events in lifecycle trace | `test-mctb-voicemail-ai-hermetic.ts` |
| AI-VM-002 | Degraded finalize — audio evidence preserved | `test-mctb-voicemail-ai-hermetic.ts` |
