# Voice V3 AI Receptionist — Wizard final completion report

**Baseline:** `master` @ `47adf8d5f20be4f93aafd1aa5fa987285e61e0ff`  
**Branch:** `cursor/voice-v3-wizard-final-completion-2304`

## Removed / hidden unsupported UI

| Surface | Change |
|---------|--------|
| Activate step | Scheduled activation cards + datetime picker; duplicate-location option; static “Active schedule” side panel (replaced with **business hours for agent behavior**) |
| Test step | Scenario certification, mark scenario checked, scenario tools checklist, Quality Studio, fake latency/tool metrics |
| Appointments | Calendly provider card and live Calendly booking strategy + event type UI |
| Call handling | Long-term caller memory + CRM enable toggles |
| Wizard footer | Schedule / duplicate / save-as-draft activate labels — final step is **Activate** only |

**Preserved:** On-call schedule, weekly business hours, holidays, after-hours behavior, transfer routing/waterfall (operational scheduling — not activation scheduling).

## UI connectivity completed

- **Activate** → `POST /api/solutions/appointment-receptionist` with `action: activate` always publishes (`activationMode: activate_now`).
- **Readiness** → `getWizardActivationIssues` + `buildWizardReadinessRows` (`wizard-readiness.ts`) from real selected capabilities.
- **Test** → `ensureAgentForTest()` → `save_draft` then `VoiceV3BrowserCall` against current `agentId` draft.

## Readiness (authoritative)

| Rule | Source | Blocks activate? |
|------|--------|------------------|
| Phone | `phoneNumberId` | Yes |
| Receptionist name | `agentName` | Yes |
| Business info | `businessName` / knowledge items / website | Yes |
| Voice / greeting | `voiceId`, `openingGreeting` | Yes |
| Calendar | `deriveBookingStrategyFromWizard` + live calendar APIs when live book | Yes (if applicable) |
| Calendly strategy | Legacy state `CALENDLY` | Yes (must change strategy) |
| Appointment types | `appointmentTypes[].enabled` | Yes (if booking on) |
| Booking link URL | `bookingLinkUrl` when `SEND_LINK` | Yes |
| Transfer dest | `transferDestinations` / legacy phone when transfer enabled | Yes |
| SMS sender | `outboundSms*` / recovery sender when SEND_LINK or AI recovery | Yes |
| Document KB | Informational when retrieval selected | No |
| Recording on | Warning in issues | No |
| Browser test | Recommended copy | No |

**Removed:** `lastTestPassed` as activation gate.

## Test

1. Customer opens Test step (draft auto-saved on Continue when entering Test).
2. **Save draft for test** or **Build & start live test** calls `onEnsureAgent` → `save_draft`.
3. Browser WebRTC session uses draft `agentId` → Voice V3 compile path (same as production resolver on published config after activate).

## Activate

```
Wizard state
  → POST /api/solutions/appointment-receptionist (action: activate)
  → buildWizardAgentConfig()
  → updateVoiceAgentDraft + publish hooks
  → VoiceAgent published config
  → resolveVoiceV3AgentConfigForAgent()
  → compileVoiceV3AgentConfig()
  → next GPT-Live / PSTN session
```

Scheduled / duplicate-location requests on activate are coerced to immediate publish with a warning (legacy cron job remains in repo but is not customer-facing).

## Existing functionality preserved

- Voice V3 runtime, compiler, Microsoft booking, post-call pipeline, on-call/transfer policy, FileSearch, spam/solicitor, AI recovery post-call SMS — **no architectural changes**.
- MCTB inbound-handling paths in API unchanged except shared appointment-receptionist route behavior above.

## Remaining external setup (customer)

- Google/Microsoft OAuth for live booking
- Outbound SMS number for send-link / AI recovery
- Knowledge indexing after upload (non-blocking unless retrieval selected without any sources)

## Certification remaining (engineering, not wizard gaps)

PSTN/browser certification matrix for deployed `47adf8d5`+ features — out of scope for this UI pass.

## Verification

- `scripts/test-voice-v3-wizard-backend-propagation.ts` — **PASS** (209/209)
