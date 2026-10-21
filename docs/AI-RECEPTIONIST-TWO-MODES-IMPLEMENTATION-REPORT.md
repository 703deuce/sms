# AI Receptionist — two operating modes (implementation report)

**Branch:** `cursor/ai-receptionist-two-modes-9779`  
**Date:** October 21, 2026

## A. Implementation summary

Restored **one product — AI Receptionist** — with a business-selected **operating mode** (`runtimeProfile`):

| Mode | Profile | Customer experience |
|------|---------|---------------------|
| **Conversational IVR** | `conversational_ivr` | Lightweight: knowledge, semantic routing, messages, transfers (4-tool allowlist unchanged) |
| **Full Receptionist** | `full_receptionist` | Above plus capabilities-gated intake, qualification, callbacks, appointments, spam screening, full Voice V3 tool catalog |

**Wired in this pass:**

- Product rename and **Operating mode** selector (Overview + Agent Settings)
- **Dynamic sidebar** from draft `runtimeProfile` (preserves all saved config when switching; publish applies live behavior)
- **Caller Intake** page (Full) vs **Message Taking** (IVR) on the same route
- **Full nav:** Appointments, Agent Settings, Caller Intake
- Overview metrics/readiness mode-aware (booked/callbacks only when relevant)
- Publish review + gate: IVR skips booking/recovery checks; Full uses **semantic routes** for transfer validation
- Appointments calendar row reads **live Integrations status** (Microsoft 365 connect path emphasized)
- Spam/unwanted caller controls in Agent Settings (Full)
- Automated static tests: `test-ai-receptionist-two-modes.mjs`, updated `test-conversational-ivr-profile.mjs`

**Preserved (not rebuilt):** semantic `conversationalRoutes`, Microsoft Graph stack (`microsoft-oauth.ts`, booking tools), Google/Calendly adapters, LiveKit/Python worker, draft/publish pipeline.

**Not in scope / unchanged:** MCTB nav (hidden unless `MCTB_UI_ENABLED`), Google Calendar prioritization (Microsoft path retained), live PSTN certification, full `tsc` cleanliness (pre-existing repo errors).

---

## B. Mode comparison

| Capability | Conversational IVR | Full Receptionist |
|------------|-------------------|-------------------|
| Business knowledge / FAQs | Yes | Yes |
| Semantic call routing | Yes | Yes |
| `transfer_call` | If enabled | If enabled |
| `take_message` | If enabled | If enabled |
| `search_business_knowledge` | If enabled | If enabled |
| `end_call` | Yes | Yes |
| Structured intake / `update_intake` | No (compile bypass) | If enabled |
| Qualification rules | No UI emphasis | If capability on |
| `request_callback` | No | If `messages.callbacks` / capability |
| Appointment request / link / live book | No runtime tools | Per strategy + capabilities |
| Microsoft/Google FIND/BOOK/reschedule/cancel | No | If live booking + provider connected |
| `report_unwanted_solicitor` | No | If protection rules enabled |
| Nav: Appointments, Agent Settings | Hidden | Shown |
| Nav label intake route | Message Taking | Caller Intake |

Mode is **business-selected only** — callers cannot unlock calendar tools in IVR mode.

---

## C. Navigation

| Item | Conversational IVR | Full Receptionist |
|------|-------------------|-------------------|
| Overview | Yes | Yes |
| Business Knowledge | Yes | Yes |
| Call Routing | Yes | Yes |
| Message Taking / Caller Intake | Message Taking | Caller Intake (same URL) |
| Appointments | — | `/app/receptionist/appointments` |
| Agent Settings | — (voice via Overview shortcut) | `/app/receptionist/agent` |
| Calls | Yes | Yes |
| Test / Analytics | Overview shortcuts only | Overview shortcuts only |

Product switcher title: **AI Receptionist**.

Legacy `/app/receptionist/call-handling` remains for advanced coverage/recovery/audio (not primary nav).

---

## D. Runtime tools (after publish)

**Conversational IVR:** subset of `end_call`, `search_business_knowledge`, `transfer_call`, `take_message` per `conversationalIvrToolAllowlist()`.

**Full Receptionist:** `enabledVoiceToolNamesFromEditor()` + `voice-tool-catalog.ts` capability gates, including scheduling tools when strategy/provider/capabilities allow.

Compile: `editor-to-voice-v3-config.ts` — IVR overrides clear intake/booking; Full uses full capabilities.

---

## E. Calendar integration (code paths — not live-verified this run)

| Area | Status |
|------|--------|
| Microsoft OAuth | `/api/integrations/calendars/oauth/microsoft` + `lib/calendar/oauth` |
| Token refresh / Graph | `lib/server/voice-v3/scheduling/microsoft-oauth.ts` |
| Publish validation live book | `resolveSchedulingBackend()` in `publish-gate.ts` |
| Appointments UI connection state | `GET /api/integrations/status` in `appointments-manager.tsx` |
| Google / Calendly | Existing adapters preserved; not focus of this pass |

**Manual required:** Connect Microsoft 365 in Integrations, select calendar, enable Full Receptionist + live booking, publish, PSTN book/reschedule/cancel.

---

## F. Automated test results

| Suite | Result |
|-------|--------|
| `node scripts/test-ai-receptionist-two-modes.mjs` | **PASS** |
| `node scripts/test-conversational-ivr-profile.mjs` | **PASS** |
| `npm run typecheck` | **FAIL** (pre-existing unrelated TS errors in repo) |

---

## G. Remaining real-call checklist

1. Conversational IVR — FAQ, semantic transfer, message  
2. Full Receptionist — intake + qualification  
3. Callback request (`request_callback`)  
4. Semantic transfer failure → message  
5. Booking link send (if enabled)  
6. Microsoft FIND/BOOK (connected tenant)  
7. Microsoft reschedule / cancel  
8. Google booking (when prioritized)  
9. Spam/solicitor screening  
10. Mode switch IVR ↔ Full after publish (tool allowlist on next call)

---

## H. Material files changed

- `new-app/lib/nav.ts`, `lib/receptionist/runtime-profile.ts`, `lib/products/mctb-ui.ts`
- `new-app/components/receptionist/operating-mode-selector.tsx`, `overview-page-content.tsx`, `caller-intake-page-content.tsx`, `intake-qualification-editor.tsx`, `call-protection-editor.tsx`, `agent-editor.tsx`, `appointments-manager.tsx`, `publish-review.tsx`
- `new-app/components/shell/sidebar-nav.tsx`, `app-header.tsx`
- `new-app/app/app/receptionist/message-taking/page.tsx`
- `new-app/lib/server/receptionist/overview-service.ts`, `lib/server/voice-v3/publish-gate.ts`
- `new-app/scripts/test-ai-receptionist-two-modes.mjs`, `test-conversational-ivr-profile.mjs`, `package.json`

---

*Semantic routing remains the only customer-facing transfer configuration. Keyword-trigger UI is not restored.*
