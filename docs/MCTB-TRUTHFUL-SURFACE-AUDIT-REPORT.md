# MCTB truthful surface audit — report (pre-merge review)

**Branch:** `cursor/mctb-truthful-surface-audit-2304`  
**Baseline:** `master` + targeted fixes  
**Status:** Implementation complete — **do not merge until this report is reviewed.**

---

## 1. AI Lead Recovery control trace (summary table)

| UI control | API / action | Persisted field | Runtime consumer | Works? | Launch decision |
|------------|--------------|-----------------|------------------|--------|-----------------|
| Master enable + scenario toggles | `POST /api/mctb/lead-recovery/config` | `enabled`, `enabledScenarios`, `enabledIntents` | `loadLeadRecoveryConfig` → inbound SMS lead-recovery pipeline | Yes | **KEEP** |
| Take a message | same | `enabledScenarios.take_message`, `intentPolicies.*` | `action-runtime` / intent router | Yes | **KEEP** |
| Booking scenario | same | `enabledScenarios.booking`, `BOOKING_REQUEST` policy | `SEND_BOOKING_LINK` path in `action-runtime` | Yes (link mode) | **KEEP** (link only) |
| Booking mode **AI_BOOK** | same (was exposed in UI) | `mode: AI_BOOK`, `actions: [AI_BOOK]` | `action-runtime` `AI_BOOK` branch | Backend exists | **HIDE** (launch flag) |
| Emergencies | same | `EMERGENCY_OR_URGENT` policy | `action-runtime` | Yes | **KEEP** |
| Pricing questions | same | `PRICING_QUESTION` / estimate intents | Policy + approved-info paths | Yes | **KEEP** |
| Service-area | same | `serviceAreaPolicy` | Runtime eligibility / FAQ-style answers | Yes | **KEEP** |
| Existing customer | same | `existingCustomerPolicy` | Runtime | Partial | **KEEP** (where supported) |
| General FAQs | same | `faqPolicy`, Company Brain | `ANSWER_APPROVED_INFORMATION`, `launch-faq-policies` | Yes | **KEEP** |
| **Payments / Text-to-Pay** | same | `enabledScenarios.payments`, `paymentPolicy` | Stripe Text-to-Pay actions | Backend exists | **REMOVE from MCTB UI** |
| Human handoff when uncertain | read-only checkbox | `handoffTriggers.uncertain` | Runtime default | Yes (locked on) | **KEEP** |
| Test AI drawer | `GET ?simulate=1` / test drawer API | n/a (simulation) | `simulateLeadRecoveryTurn` | Yes | **KEEP** |
| Policy health rail | `GET` health payload | derived | `computeLeadRecoveryPolicyHealth` | Yes | **KEEP** |
| Connected services (calendar) | `/api/mctb/ai-booking/config` | AI booking config | AI_BOOK only | N/A when AI_BOOK hidden | **Hide AI book targets** |
| Connected services (Stripe) | providers.stripe in config GET | workspace Stripe | Text-to-Pay | Out of scope | **HIDE** |

**Company Brain path:** `GET /api/mctb/lead-recovery/config` loads `loadBusinessBrain` → `knowledge.approvedCount` → FAQ policies use `ANSWER_APPROVED_INFORMATION` (`launch-faq-policies.ts`). No Voice V3 RAG / LiveKit wiring on this page.

---

## 2. Genuinely wired controls (kept)

Scenario cards and policy editors for: take message, booking (**send link**), emergencies, pricing, service area, existing customer, general FAQs; master enable; handoff; test simulation; notifications handoff integration (separate setup page).

---

## 3. Hidden / removed controls and why

| Control | Change |
|---------|--------|
| **Payments** scenario card + `PaymentsEditor` | Hidden via `MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI`; forced off on save |
| **AI_BOOK** booking radio + emergency AI_BOOK checkbox | Hidden via `MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI`; coerced to `SEND_BOOKING_LINK` on save |
| Stripe provider block on LR rail | Hidden when Text-to-Pay UI flag on |
| AI booking target picker on rail | Hidden when AI_BOOK UI flag on |
| Missed Calls **consent mode** filter | **Removed** — rows lack `consentMode`; filter was misleading |

---

## 4. Text-to-Pay

**Not implemented.** MCTB AI Lead Recovery no longer exposes Text-to-Pay scenario or payment policy UI. Shared `/payments` product untouched.

---

## 5. AI_BOOK

**Remains disabled for launch** in customer UI. Backend code preserved. Launch booking path: intent → `SEND_BOOKING_LINK` → configured URL (`launch-lead-recovery.ts` asserts no `AI_BOOK` in launch actions).

---

## 6. Company Brain

Confirmed: approved facts from `loadBusinessBrain` → LR config GET `knowledge` → FAQ / approved-information actions. No connection to Voice Agent knowledge crawl.

---

## 7. Voice Agent Call Handling trace

| Before | After |
|--------|--------|
| `CallHandlingModeSwitch` → `GET/PATCH /api/mctb/inbound-handling` | `CallHandlingModeSwitch` → **`CallHandlingDashboardCard`** → `GET/PATCH /api/call-handling` only |

Voice Agent wizard/configuration (`AppointmentReceptionistWizard`) unchanged.

---

## 8. `/api/mctb/inbound-handling` customer reachability

- **Voice Agent page:** no longer calls this API (grep: only comment removed).
- **Backend route preserved** for compatibility (wizard phone step, appointment-receptionist save paths may still reference inbound-handling libs).
- **Canonical customer mutation:** `/api/call-handling` only (header, sidebar, overview, voice agent card).

---

## 9. Calls detail fake-data audit

**Before:** hardcoded `$0.15`, `Twilio`, `MOCK_ACTIVITY_EVENTS` for real calls.

**After:** Reused from `cursor/voice-ui-closure-2304`:

- `src/lib/voice/calls/customer-activity-feed.ts` (+ unit test)
- Updated `src/app/(app)/voice/calls/[id]/page.tsx`
- Updated `src/app/api/voice/calls/[id]/route.ts`

Real metadata: provider label, cost when available, activity feed from tools/transfers/recordings; unavailable states when missing.

---

## 10. `cursor/voice-ui-closure-2304` reuse

**Yes.** Cherry-picked call-detail + activity feed files (see §9). Branch also contains knowledge crawl UI not imported here (out of scope).

---

## 11. Missed Calls consent filter

**Decision B:** removed filter from UI (`missed-calls-view.tsx`). API/query param may still exist but is not offered to customers until rows expose authoritative per-event consent mode.

---

## 12. Files changed

- `src/components/mctb/voice-agent/call-handling-mode-switch.tsx`
- `src/lib/mctb/launch-flags.ts`
- `src/components/mctb/lead-recovery/ai-lead-recovery-page.tsx`
- `src/components/mctb/missed-calls-view.tsx`
- `src/lib/voice/calls/customer-activity-feed.ts` (new)
- `src/lib/voice/calls/customer-activity-feed.test.ts` (new)
- `src/app/(app)/voice/calls/[id]/page.tsx`
- `src/app/api/voice/calls/[id]/route.ts`
- `scripts/test-mctb-simplified-launch.ts`
- `docs/MCTB-TRUTHFUL-SURFACE-AUDIT-REPORT.md` (this file)

---

## 13. Tests passed (this run)

| Test | Result |
|------|--------|
| `npx tsx scripts/test-call-handling-ownership.ts` | PASS |
| `npx tsx scripts/test-call-handling-pstn-wizard-binding.ts` | PASS |
| `npx tsx scripts/test-mctb-simplified-launch.ts` | PASS |
| `npx tsx scripts/test-cross-surface-ownership-audit.ts` | PASS |
| `npx tsx scripts/test-mctb-final-pipeline-contract.ts` | ok |
| `npx tsx scripts/test-mctb-handoff.ts` | PASS |
| `npx tsx src/lib/voice/calls/customer-activity-feed.test.ts` | ok |

Not run (DB/heavy): full `test:voice-v3-wizard-backend-propagation`, full MCTB setup browser suite.

---

## 14. Unresolved gaps

- **PLATFORM/CUSTOMER sender mode** — intentionally not started (separate task).
- **Missed-call consent filter** — re-enable when list rows carry authoritative consent mode per event.
- **Calls in MCTB nav** — add to `mctb-nav.ts` after product sign-off (detail page now uses real metadata).
- **`/api/mctb/inbound-handling`** — still exists for legacy/wizard internal callers; monitor for drift vs `/api/call-handling`.
- **PaymentsEditor** function remains in `ai-lead-recovery-page.tsx` (dead code) — optional cleanup later.

---

## Menu inventory reference

See `docs/MCTB-MENU-PAGE-INVENTORY.md` (separate PR) for full sidebar page lists.
