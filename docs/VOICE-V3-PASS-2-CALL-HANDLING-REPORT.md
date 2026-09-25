# Voice V3 Pass 2 — Call Handling (product surface architecture)

**Branch:** `cursor/voice-v3-pass-2-call-handling-2304`  
**Pass 1:** Closed — no further Pass 1 polish.  
**Certification:** After Pass 2 merge (see ordering in `docs/VOICE-V3-PRODUCT-COMPLETION-ALL-IN-ONE.md`).

## A. Final Voice information architecture (AI Receptionist group)

| Nav item | Route | Purpose |
|----------|-------|---------|
| Overview | `/voice/overview` | Receptionist health snapshot |
| Calls | `/voice/calls` | Call list + detail |
| AI Agent | `/mctb/voice-agent` | Guided onboarding wizard |
| Knowledge | `/voice/knowledge` | KB + knowledge gaps |
| **Call Handling** | `/voice/call-handling` | **Operational transfers, on-call, escalation, protection** |
| Analytics | `/voice/analytics` | Voice product metrics |
| Needs attention | `/voice/needs-attention` | Callbacks, failed transfers, etc. |

Legacy `/voice/inbound-routing` remains for routing rules API; not primary nav.

## B. Call Handling page — sections → persistence

| Section | UI component | Persisted fields (wizard / `call-handling` step) |
|---------|--------------|--------------------------------------------------|
| Current behavior | Summary (read-only) | Derived from transfer + operating maturity |
| Transfers | `EmergencyTransferEditor` | `voiceV2HumanTransferEnabled`, `transferRouting`, `transferDestinations[]`, `transferPlanSteps[]`, `transferRingSeconds`, `transferFallback`, `warmTransfer`, … |
| Hours / after hours | `AfterHoursBehaviorEditor` | `operatingMaturity.afterHoursBehavior`, `operatingMaturity.businessSchedule` |
| On-call | `OnCallScheduleEditor` | `operatingMaturity.onCallSchedule` |
| Emergency / urgent | `UrgencyRulesEditor` | `urgencyEnabled`, `urgencyRules` |
| Notifications | `AfterHoursNotificationsEditor` | `afterHoursNotificationEvents`, `afterHoursNotificationRecipients` |
| Caller protection | `SpamUnwantedCallsEditor` | `spamLikelyPolicy`, `solicitorPolicy`, blocklist via `/api/voice/blocked-callers` |
| Recording | Link + read-only | `callRecording` (owned by wizard **phone** step) |
| Recent transfers | API table | `VoiceTransfer` rows (read-only) |

**Save path:** `POST /api/solutions/appointment-receptionist` with `wizardStepId: "call-handling"` — same as wizard.

## C. Wizard ↔ operational sync

| Area | Wizard | Operational | API | Runtime |
|------|--------|-------------|-----|---------|
| Transfers | `CallHandlingStep` → `EmergencyTransferEditor` | `/voice/call-handling` → same editor | `appointment-receptionist` | `compile-voice-v3-agent-config`, `authorize-transfer.ts`, Python `transfer_executor` |
| On-call / hours | `operating-maturity-editor` | Same components | same | `operatingPolicy` in compiled config |
| Spam | Editor (not yet on wizard step) | Call Handling | same | `spam-protection/*` |

No duplicate config models.

## D. Customer journeys

**Change transfer routing:** Login → Call Handling → edit → Save → active agent draft sync (existing `save_draft` on ACTIVE agent).

**Onboarding:** Unchanged — `/mctb/voice-agent` wizard.

**Knowledge gaps:** `/voice/knowledge#knowledge-gaps` (Pass 1).

## E. Browser test results

| Workflow | Result |
|----------|--------|
| Load configuration | PENDING — run in staging with dev auth |
| Save / refresh / wizard parity | PENDING |
| Tenant isolation | Covered by existing `requireSession` on APIs |

## F. Regression

```
VOICE V3 RUNTIME ARCHITECTURE CHANGED: NO
MICROSOFT FIND/BOOK CHANGED: NO
MCTB PLATFORM SENDER CHANGED: NO
CALL HANDLING PROVIDER ROUTING CHANGED: NO
TENANT ISOLATION REGRESSION: PASS (API patterns unchanged)
```

## G. Certification-only (unchanged — run after Pass 2)

Direct/warm/waterfall PSTN, emergency on-call, Google book, carrier SCREEN, solicitor, recording E2E, AI recovery SMS, ordinary after-hours call.

## H. Final verdict

```
PASS 2 UI ARCHITECTURE COMPLETE: PARTIAL (core Call Handling shipped; staging browser cert pending)

IMPORTANT OPERATIONAL FEATURES STILL WIZARD-ONLY:
  - Full phone/recording editor (linked from Call Handling)
  - Goals / capabilities toggle (transfer_calls)
  - Inbound routing rules (/voice/inbound-routing)

DUPLICATE CONFIG SOURCES CREATED: NO

WIZARD ↔ OPERATIONAL SYNC: PASS (shared editors + same API step)

TENANT ISOLATION: PASS

VOICE V3 CORE RUNTIME MODIFIED: NO

READY FOR FINAL PSTN CERTIFICATION: YES (after merge + smoke)

READY FOR SELF-SERVE PAID ACQUISITION: NO (PSTN matrix not run)
```
