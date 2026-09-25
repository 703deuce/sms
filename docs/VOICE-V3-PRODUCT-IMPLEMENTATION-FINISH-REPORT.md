# Voice V3 — Product implementation finish report

**Date:** 2026-09-25  
**Branches:** Pass 1 `#505`, Pass 2 + finish `#506` (`cursor/voice-v3-pass-2-call-handling-2304`)  
**Certification:** Not performed in Cursor — **owner certification required** (browser, PSTN, providers).

## Ingress vs Amy Call Handling (boundary)

| Concern | Canonical surface | Persistence / runtime |
|--------|-------------------|------------------------|
| **Who answers the forwarded PSTN call** (MCTB vs AI Receptionist) | `/api/call-handling` + `CallHandlingSwitcher` | `phoneNumber.settingsJson` active handler; Telnyx routing (do not mutate in impl pass) |
| **CFNA / keep your number** | `VoiceIngressSetupPanel` on `/voice/call-handling`, MCTB `/mctb/setup/phone`, wizard Phone step | Business line + ingress E164 from `/api/mctb/inbound-handling` + `/api/call-handling` |
| **Amy after answer** (transfer, waterfall, on-call, spam) | `/voice/call-handling` | `appointmentReceptionistWizard` via `POST /api/solutions/appointment-receptionist` |
| **Rule-based inbound routing** | `/voice/inbound-routing` | `/api/voice/routing` — **not** merged into Call Handling |

## §33 — Implementation matrix

| Capability | Backend/runtime | Customer config UI | Operational UI | Result/history UI | Remaining implementation | Owner cert later |
|------------|-----------------|--------------------|----------------|-------------------|--------------------------|------------------|
| GPT-Live Amy | Yes | Wizard | AI Agent | Calls | NONE | PSTN smoke |
| CFNA / keep number | Yes | MCTB phone + wizard phone | Call Handling ingress panel | — | NONE | Carrier forward + ingress |
| Transfer direct/warm/waterfall | Yes | Wizard + Call Handling | Call Handling | Call detail + recent transfers | NONE | PSTN matrix |
| Transfer effective state | Yes | Call Handling capability toggle | TransferEffectiveStatusCard | Summary | NONE | PSTN |
| On-call | Yes | Wizard + Call Handling | Call Handling | Summary + runtime | NONE | PSTN on-call |
| Business hours / after-hours | Yes | Wizard + Call Handling | BusinessSchedule + AfterHoursBehavior | Summary | NONE | — |
| Urgency / emergency | Yes | Call Handling | Call Handling | Call detail | NONE | PSTN |
| Transfer fallback | Yes | EmergencyTransferEditor | Call Handling | — | NONE | PSTN |
| Notifications | Yes | Call Handling | Call Handling | Email/SMS delivery | NONE | Deliverability |
| Spam / solicitor / blocklist | Yes | Call Handling | SpamUnwantedCallsEditor + API | Call outcomes | NONE | PSTN SCREEN/DECLINE |
| Recording config | Yes | Wizard phone + Call Handling card | Call Handling | Call detail player | NONE | Ingest/playback E2E |
| Knowledge gaps | Yes | Knowledge | `/voice/knowledge#knowledge-gaps` | Call detail section | NONE | Live calls |
| Voice analytics | Yes | — | `/voice/analytics` | Dashboard | NONE | — |
| Needs attention | Yes | — | `/voice/needs-attention` | Overview link | NONE | — |
| MS FIND/BOOK | Yes | Wizard appointments | AI Agent | Call detail | NONE | PSTN regression |
| Google book | Yes | Wizard | AI Agent | Call detail | NONE | PSTN book |
| Calendly V3 | Blocked | — | — | — | OUT OF SCOPE | — |
| Booking link / recovery SMS | Yes | Wizard | AI Agent / Call Handling deps | SMS thread | NONE | Sender + PSTN SMS |
| Inbound routing rules | Yes | `/voice/inbound-routing` | Same (advanced) | — | NONE | — |
| Morning digest | Generic infra | Settings prefs | — | Email | OUT OF SCOPE (not Voice product) | — |

## §34 — UI inventory

### Primary Voice navigation (AI Receptionist group)

| Item | Route | Purpose |
|------|-------|---------|
| Overview | `/voice/overview` | Status + quick links |
| Calls | `/voice/calls` | Operational call list/detail |
| AI Agent | `/mctb/voice-agent` | Onboarding wizard |
| Knowledge | `/voice/knowledge` | KB + gaps |
| Call Handling | `/voice/call-handling` | Transfers, hours, on-call, protection, ingress |
| Analytics | `/voice/analytics` | Voice metrics |
| Needs attention | `/voice/needs-attention` | Action queue |

### Wizard-only by design

Initial goals/capabilities breadth, voice persona, test harness, activate/publish flow, full appointment booking setup depth.

### Operational pages

Call Handling, Knowledge (+ gaps), Analytics, Needs Attention, Calls.

### Compatibility / legacy

| Route | Behavior |
|-------|----------|
| `/voice/operations` | Redirect → `/voice/call-handling` |
| `/voice/analytics/after-hours` | Redirect → `/voice/analytics` |
| `/voice/inbound-routing` | Advanced routing (banner explains vs Call Handling) |
| `/voice/receptionist` | Redirect legacy |

### Hidden / out of scope

Mass campaigns, Calendly V3 live, Voice morning digest product, human backup call center.

## §35 — Self-service gap list

**Target:** No routine customer-specific DB/JSON edits by Transovo staff.

| Gap | Status |
|-----|--------|
| Transfer capability only in wizard | **Fixed** — toggle on Call Handling (`capabilities` + compile-aligned status) |
| CFNA / ingress unclear | **Fixed** — ingress panel + links |
| Recording buried in wizard | **Fixed** — inline card + deep link `?step=phone` |
| Knowledge gaps on call detail | **Fixed** — section + link to Knowledge |
| Spam editor only on Call Handling | **OK** — canonical operational owner |

**Remaining legitimate customer actions (not staff intervention):** OAuth (Microsoft/Google), carrier CFNA on handset, platform Telnyx/LiveKit provisioning.

## §32 — Owner certification list (do not run in Cursor)

IMPLEMENTATION COMPLETE — OWNER CERTIFICATION REQUIRED:

- Ordinary after-hours PSTN call
- Microsoft FIND/BOOK regression
- Google live booking
- Direct / warm / waterfall transfer + exhaustion
- Emergency / on-call PSTN
- Carrier Spam Likely SCREEN
- Solicitor DECLINE on PSTN
- Recording ingest + playback
- Transcript / summary / email chain
- Customer webhooks
- AI recovery SMS
- CFNA / Voice ingress end-to-end
- UI/browser parity (wizard ↔ Call Handling save)

## §36 — Final verdict

```
VOICE V3 PRODUCT IMPLEMENTATION COMPLETE: YES

REMAINING BACKEND/RUNTIME IMPLEMENTATION GAPS:
  - NONE (launch scope)

REMAINING CUSTOMER CONFIGURATION UI GAPS:
  - NONE (launch scope)

REMAINING OPERATIONAL UI GAPS:
  - NONE (launch scope; advanced inbound routing remains intentionally separate)

REMAINING RESULT/HISTORY UI GAPS:
  - NONE (launch scope)

NORMAL CUSTOMER ACTIONS REQUIRING TRANSOVO MANUAL INTERVENTION:
  - NONE for configured product surfaces (platform provisioning excluded)

CFNA / VOICE INGRESS CUSTOMER SURFACE: COMPLETE

CALL HANDLING OPERATIONAL SURFACE: COMPLETE

TRANSFER EFFECTIVE ENABLED STATE REPRESENTED: YES

ON-CALL OPERATIONAL MANAGEMENT: COMPLETE

CALLER PROTECTION MANAGEMENT: COMPLETE

RECORDING CONFIGURATION DISCOVERABLE: YES

KNOWLEDGE GAP OWNER WORKFLOW: COMPLETE

VOICE ANALYTICS: COMPLETE

NEEDS ATTENTION: COMPLETE

VOICE NAVIGATION: COMPLETE

DUPLICATE CONFIG MODELS CREATED: NO

VOICE V3 CORE RUNTIME ARCHITECTURE CHANGED: NO

MICROSOFT FIND/BOOK CHANGED: NO

MCTB PLATFORM SENDER CHANGED: NO

READY FOR OWNER CERTIFICATION: YES
```

## Static validation run (Cursor)

- `npx tsx scripts/test-voice-effective-transfer-state.ts` — PASS  
- `npx tsx scripts/test-mctb-nav-ia.ts` — PASS  
