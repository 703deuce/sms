# MCTB Voice Agent Wizard — What’s on Each of the 8 Screens

**Customer route:** `/mctb/voice-agent`  
**Component:** `MctbVoiceAgentPage` → `AppointmentReceptionistWizard` with `presentation="mctb"`  
**API:** `POST /api/solutions/appointment-receptionist` (save draft / activate)  
**Deep links:** `?step=goals|phone|information|booking|call-handling|voice|test|activate` and optional `?agentId=`

This is the **AI voice agent / after-hours receptionist** setup embedded in the MCTB product—not the six-step MCTB **missed-call text-back** onboarding at `/onboarding/mctb`.

---

## Page chrome (above the wizard)

Visible on every step:

1. **Header**
   - Title: defaults to **“After-Hours Voice Agent”** (updates from wizard `solutionName`).
   - Status pill: **Draft** | **Active** | **Needs attention** (when known).
   - Subtitle: answer missed/after-hours calls with an AI agent that follows business rules.
   - **Test agent** button (scrolls to Continue / test area).

2. **Call Handling mode switch** (`CallHandlingModeSwitch`)
   - Shows who answers forwarded calls on the canonical ingress: **Missed Call Text Back (recovery)** vs **AI Receptionist (voice agent)**.
   - Uses `/api/mctb/inbound-handling`; can switch mode when voice agent is ready.
   - Link to MCTB setup/phone context when forwarding is incomplete.

3. **Mobile step indicator:** `Step N of 8 · {label}`

4. **Horizontal stepper** (`WizardStepper`)
   - All eight steps with MCTB labels; clickable to jump between steps (MCTB only).
   - Per-step readiness badges when MCTB step readiness is computed.

5. **Sticky footer (every step)**
   - **Back**
   - **Save** (persists draft to API)
   - **Continue** (saves as needed, advances; on last step label is **Activate** and runs activate)

---

## The eight steps (canonical order)

| # | Step ID (code) | MCTB stepper label | React component |
|---|----------------|-------------------|-----------------|
| 1 | `goals` | **Purpose** | `GoalsStep` |
| 2 | `phone` | **Phone** | `PhoneStep` |
| 3 | `information` | **Business Knowledge** | `InformationStep` |
| 4 | `appointments` | **Booking** | `AppointmentsStep` |
| 5 | `call-handling` | **Call Handling** | `CallHandlingStep` |
| 6 | `voice` | **Voice** | `VoiceStep` |
| 7 | `test` | **Test** | `TestStep` |
| 8 | `activate` | **Activate** | `ActivateStep` |

### When is “Booking” (step 4) hidden?

The **Appointments** step is **omitted from the stepper** only if the user turns off all booking-related capabilities (`book_appointments`, `reschedule`, `cancel`) on **Purpose**.

The default MCTB voice-agent preset (`after_hours`) **includes `book_appointments`**, so a fresh agent normally shows **all 8 steps**.

---

## Screen 1 — Purpose (`goals`)

**Headline area (in step):**

- **Agent name** field (`solutionName`) — dashboard name for this voice agent instance.
- **“What should your voice agent handle?”** — grid of capability cards (options depend on preset; `after_hours` allowlist):
  - Answer common questions  
  - Book new appointments  
  - Reschedule appointments *(if in allowlist)*  
  - Cancel appointments *(if in allowlist)*  
  - Take messages  
  - Qualify new callers *(if in allowlist)*  
  - Transfer calls  
  - Send confirmations by text  
- **“When should this agent answer?”** — radio options (for `after_hours` preset typically includes):
  - Every incoming call  
  - Only when nobody answers  
  - **After hours only** (default for MCTB after-hours preset)  
  - When the line is busy  
  - Custom schedule  

**Right side panel — “Agent summary” (MCTB):**

- Purpose: After-hours call recovery  
- Enabled capabilities count  
- Policy source: AI Lead Recovery  
- Booking: Available / Off  
- Transfer: Ready / Needs setup / Off  

**Continue behavior:** Creating a draft agent on first Continue from step 1 if none exists yet.

---

## Screen 2 — Phone (`phone`)

**Title:** “Where should the agent answer?”

**Readiness chips:**

- Phone number (needed until selected)  
- Inbound calling (ready)  
- AI Voice (ready)  
- Call recording (optional until enabled)  

**MCTB-specific callout (when forwarding already set up):**

- Business line already connected via MCTB forwarding  
- Transovo ingress number and forwarding status  

**Number source cards:**

- **Use existing MCTB line** (recommended when MCTB forwarding exists)  
- Use existing Transovo number (pick from workspace list)  
- Buy a new number (link to My Numbers)  
- Forward an existing business number (instructions + pick Transovo DID to forward to)  

**Per-number list details when selecting:**

- Friendly name, MCTB TeXML ingress warning, other AI owner warning, softphone assignment warning  

**Answering behavior (ring behavior):**

- Answer every incoming call  
- Ring team first then use AI  
- After-hours only  
- When the line is busy  
- Custom schedule  

**Settings:**

- Ring team for (10–45 seconds)  
- Call recording: all / inbound only / off  

**Connection greeting (“While the receptionist connects”):**

- No connection greeting  
- Transovo professional / warm greeting  
- Upload custom / create custom  
- Preview (browser speech synthesis) and greeting text when not “none”  

**Right side panel:** Call flow preview (inbound → connection greeting → AI answers → booking or message/transfer path depending on capabilities).

---

## Screen 3 — Business Knowledge (`information`)

**Title:** “Business Knowledge”

**Intro:** Facts written into agent knowledge on save/activate.

**Document search toggle:**

- “Search uploaded documents during calls” (RAG); when off, profile facts/FAQs still work  

**Knowledge source (pick one primary path):**

1. **Import from your website** — URL + **Scan** (website crawl into knowledge items)  
2. **Complete guided business profile** — fields: business name, address/locations, hours, services, pricing (optional), policies (optional); **Save profile to knowledge**  
3. **Upload documents** — PDF, DOCX, TXT, MD, CSV (indexed to knowledge base / Telnyx RAG when enabled)  
4. **Connect existing data** — select existing workspace knowledge base; links to Integrations and `/voice/knowledge`  

**Knowledge items list:**

- Rows: Business details, hours, services, etc. with status pills (Configured, Pending review, etc.)  
- **Approve** on extracted items; **Edit** modal (label + facts text)  
- **Approve all imported facts for shared brain** when pending items exist  

**Business schedule editor** (`BusinessScheduleEditor`) — weekly hours/timezone used for agent **behavior** (not carrier forwarding).

**Right side panel — “Knowledge quality”:** checklist of knowledge items and completeness.

---

## Screen 4 — Booking (`appointments`)

**Title:** “Booking”

**Calendar connection:**

- MCTB UI emphasizes **Microsoft Calendar** card (connect via Integrations)  
- Connection status on card  

**“When someone wants an appointment”** — booking strategy (radio):

1. **Book an appointment for them** — live Microsoft 365 calendar book on the call (`MICROSOFT_365`)  
2. **Take preferred time and confirm later** (`REQUEST_ONLY`)  
3. **Send our booking link** (`SEND_LINK`) — requires booking URL, SMS sender number, optional consent-before-send, message preview, optional link label  
4. **Take a message / follow up** (`NONE`) — turns off book capability, enables message path  

**Appointment types table:**

- Add appointment type; columns: name (enable checkbox), duration, calendar, status (Ready / Needs rules)  
- Selecting a row opens **Appointment configuration** panel: name, description, duration, location, modality, booking hours, notice, max days ahead, required fields, booking permission, etc. (full editor in component)  

**Side panel:** booking/calendar readiness summary (varies by connection state).

---

## Screen 5 — Call Handling (`call-handling`)

**Title:** “How should your agent handle calls?”

**MCTB flow diagram (5 steps):**

1. Understand request  
2. Apply business policy  
3. Collect what’s needed  
4. Perform allowed action  
5. Confirm or hand off  

**Emergency & human transfer:**

- Policy triggers summary  
- **EmergencyTransferEditor** — transfer destinations, phones, warm/basic, waterfall-style routing config  
- **MCTB-only extras:**
  - Urgent-call handling toggle + **UrgencyRulesEditor**  
  - Sales / solicitation handling toggle  

**Messages & callbacks:**

- Toggle: take messages and callback requests  
- **CallbackRequiredFieldsEditor** — which intake fields are required for callbacks  

**After-hours notifications:**

- **AfterHoursNotificationsEditor** — SMS/email alerts on outcomes (does not change call record)  

**AI Call Recovery:**

- Toggle: text callers when AI conversation ends unresolved  
- When on: messaging permission mode, continue conversation over SMS, send delay  

**Also on this step (editors below the grid):**

- **AfterHoursBehaviorEditor** — how agent behaves outside business hours  
- **OnCallScheduleEditor** — on-call windows  
- **CallbackSlaEditor** — callback SLA expectations  

**If booking capabilities on:** additional **Booking behavior** checkboxes (preferred day first, offer earliest three, confirm before booking, SMS after booking).

**Right side panel:** “Call handling preview” — ordered list of what happens on a call.

---

## Screen 6 — Voice (`voice`)

**Title:** “How should your agent sound?”

**Identity card:**

- Agent name (spoken identity)  
- Business name  
- Role (dropdown: front-desk, appointment coordinator, office assistant)  
- Tone, speaking style, language  

**Greeting behavior:**

- AI speaks first vs caller speaks first  
- Opening greeting textarea (500 char) with `{{businessName}}` / `{{agentName}}` preview  

**Conversation behavior toggles:**

- Keep answers brief  
- One question at a time  
- Confirm names and numbers  
- Never invent pricing  
- Never invent availability  

**Voice selection card:**

- Grid of built-in GPT-Live voices with **preview** (TTS API)  
- Speaking speed / pace controls (and related live-prompt controls in same step)  
- Optional custom OpenAI voice when env flag enabled  

**Right side panel:** voice/test reminders and selected voice summary.

---

## Screen 7 — Test (`test`)

**Title:** “Test your voice agent”

**Modes:**

- **Test in browser** — Voice V3 browser call (`VoiceV3BrowserCall`) against saved draft agent  
- **After activate (phone)** — instructions to call assigned number on PSTN after activation  

**Actions:**

- **Save draft for test** / **Build & start live test** (creates/updates draft, then WebRTC GPT-Live session)  
- Uses same Voice V3 compiler path as production (not full PSTN certification)  

**Right side panel:**

- Selected voice  
- Draft live test status (connected / ready / save draft first)  

**Tip callout:** change settings → save → new browser test → then Activate.

**Continue behavior:** Entering Test step triggers save draft if advancing from prior step.

---

## Screen 8 — Activate (`activate`)

**Title:** “Ready to turn on your voice agent?”

**Summary card:** solution name + explanation that published config applies when calls reach Transovo (hours/on-call affect conversation behavior, not carrier forward timing).

**Needs attention list:** blocking and warning issues from activation checklist (`getWizardActivationIssues`).

**Readiness grid:** rows with Ready / Needs setup / N/A (phone, calendar, knowledge, transfer, etc. via `buildWizardReadinessRows`).

**Right side panel — Activate:**

- Phone number  
- Business hours (agent behavior summary)  
- AI receptionist name  
- **Activate** button (disabled if blocking issues)  
- **Test in browser first** (jumps to Test step)  
- Callout: activate saves and publishes wizard snapshot; on-call/transfer/after-hours apply after call reaches agent  

**Footer Continue** on this step also runs **Activate** (same as panel button).

---

## Default MCTB preset (what loads first)

From `mctbDefaultState()` / `applyWizardPreset(..., "after_hours")`:

- **Solution name:** “After-Hours Voice Agent”  
- **Role:** “After-hours voice agent”  
- **answerWhen / ringBehavior:** after hours  
- **Capabilities (typical):** answer questions, take messages, transfer calls, book appointments, send SMS confirmations  
- **Test scenario default:** business_question  

Local draft persistence key: `transovo.mctb.voice-agent.wizard.v1`

---

## Related routes (not wizard steps)

| Route | Role |
|-------|------|
| `/voice/agents/[id]/about` | Post-wizard agent “About” (AI After Hours nav) |
| `/voice/agents/[id]/capabilities` | Capability toggles / advanced agent config |
| `/voice/calls` | Call history after live |
| `/voice/knowledge` | Standalone knowledge base admin |
| `/voice/inbound-routing` | Rule-based routing (separate from MCTB canonical switch) |
| `/mctb/setup/*` | Missed-call text-back setup (separate product config) |

---

## Source files (for engineers)

| Area | Path |
|------|------|
| Page shell | `src/components/mctb/voice-agent/mctb-voice-agent-page.tsx` |
| Wizard orchestration | `src/components/solutions/appointment-receptionist/wizard.tsx` |
| MCTB step labels / query | `src/lib/mctb/voice-agent/wizard-steps.ts` |
| Step readiness | `src/lib/mctb/voice-agent/step-readiness.ts` |
| Steps | `src/components/solutions/appointment-receptionist/steps/*.tsx` |
| Types & step IDs | `src/lib/solutions/appointment-receptionist/types.ts` |
| Presets & capabilities | `src/lib/solutions/appointment-receptionist/defaults.ts`, `wizard-presets.ts` |

---

*Inventory from production source as of the MCTB simplified launch line. UI copy may vary slightly by preset and feature flags.*
