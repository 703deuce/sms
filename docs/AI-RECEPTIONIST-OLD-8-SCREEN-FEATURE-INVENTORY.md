# AI Receptionist (legacy Transovo app) — 8-screen setup inventory

**Purpose:** Copy-friendly checklist of what the **old** AI Receptionist (Appointment Receptionist) setup included — every wizard screen, major UI block, and what it does at runtime.

**Canonical routes (old app):**

| Surface | Route |
|--------|--------|
| Summary / home | `/voice/receptionist` |
| 8-step setup wizard | `/voice/receptionist/edit?step=<stepId>&agentId=…` |

**Wizard step order (fixed):** Goals → Phone → Information → Appointments → Call Handling → Voice → Test → Activate

**Note:** Step **Appointments** is **hidden** when Goals did not enable any booking capability (`book_appointments`, `reschedule`, or `cancel`). Hire-Amy mode can rename Goals → “Assignment” and skip Information if Company Brain already ran.

**Primary code (reference only):** `src/components/solutions/appointment-receptionist/` · API `POST/GET /api/solutions/appointment-receptionist`

---

## Summary page (before / after wizard)

**Route:** `/voice/receptionist`  
**Job:** Read-only operational snapshot — not the editor.

| Area | What it shows / does |
|------|----------------------|
| Header | Title “Receptionist”, **Refresh summary**, **Open setup wizard** |
| Status panel | Agent initial, name, voice label |
| Live status pill | Draft / published / pending live sync |
| Phone | Assigned E.164 (if any) |
| Answering | When the agent answers (every call, overflow, after hours, etc.) |
| LiveKit ingress | SIP/runtime health label |
| Hours | Business hours summary (behavior, not carrier forwarding) |
| Calendar | Connected calendar label (if booking) |
| Setup problems | Bullet list of blockers from overview API |
| Greeting panel | Opening greeting callers hear (quoted) |
| Capabilities panel | Each enabled capability with label + detail; transfer/callback one-liner |
| First-run | Empty state → wizard at `step=goals` |

**Data source:** `GET /api/voice/overview?hub=1`

---

## Wizard shell (all 8 steps)

| Element | What it does |
|---------|----------------|
| Stepper | Shows current step; jump to another step (dirty → confirm save) |
| Save & continue | `save_draft` or `create_draft` on step 0, then advance |
| Save draft | Persists wizard snapshot without publishing live calls |
| Activate (step 8) | `activate` — publish + provider sync |
| localStorage | Secondary cache `transovo.appointment-receptionist.wizard.v1` |
| Server hydrate | `GET /api/solutions/appointment-receptionist` wins when `agentId` exists |
| Voice product switch | Dialog if selected phone is owned by MCTB / another product |
| Per-step merge | Only fields “owned” by current `wizardStepId` apply from client (prevents wiping other steps) |
| Conversation guardrails | Forced on save (brief, one question, confirm details, no invented pricing/availability) — **no UI toggles** |

---

## Screen 1 — Goals (`step=goals`)

**Job:** Define **what** the agent is allowed to do and **when** it should answer (routing mode).

### Capabilities (toggle cards)

Each capability turns on tools + downstream UI (e.g. Appointments step, booking toggles).

| ID | UI title | What it enables |
|----|----------|-----------------|
| `answer_questions` | Answer common questions | Hours, services, pricing, policies, directions from knowledge |
| `book_appointments` | Book new appointments | Calendar booking flow; shows Appointments step |
| `reschedule` | Reschedule appointments | Reschedule tools |
| `cancel` | Cancel appointments | Cancel tools |
| `take_messages` | Take messages | Message-taking / callback flows |
| `qualify_callers` | Qualify new callers | Screening / qualification rules (with Appointments collect fields) |
| `transfer_calls` | Transfer calls | Human transfer destinations + policies |
| `send_sms_confirmations` | Send confirmations by text | SMS after booking / link sends |

Preset from URL (`?preset=`) limits which capabilities appear (e.g. answering-only presets hide booking caps).

### When should this agent answer? (`answerWhen`)

| Mode | Label (typical) | Behavior |
|------|-----------------|----------|
| `every_call` | Main receptionist / every incoming call | AI answers immediately on assigned number |
| `nobody_answers` | Overflow | Ring team first, then AI |
| `after_hours` | After-hours | AI on nights/weekends/holidays; may use CFNA forwarding model |
| `line_busy` | Line busy | Overflow when line busy |
| `custom_schedule` | Custom schedule | Team during business hours, AI after (workspace hours) |

Maps to `ringBehavior`, workflow triggers, and automation routing.

### Other fields

| Field | Purpose |
|-------|---------|
| Solution name | Dashboard label for this agent/setup |
| Agent name (some layouts) | Shown in team/automations |
| Side panel | Recommended setup copy per preset |
| Hire Amy mode (`?hire=amy`) | Locks booking capabilities; focuses on assignment not “pick a job” |

**Save weight:** Lightweight — no KB crawl, no live Telnyx sync on draft.

---

## Screen 2 — Phone (`step=phone`)

**Job:** Assign **inbound voice number**, **how calls reach AI**, connection audio, recording, outbound SMS sender (for later booking-link texts).

### Number source (cards)

| Source | Purpose |
|--------|---------|
| Use existing Transovo number | Pick from workspace Telnyx voice numbers |
| Buy a new number | Link to Numbers purchase |
| Forward existing business number | Carrier CFNA → Transovo ingress (instructions) |
| MCTB line reuse (MCTB presentation only) | Reuse MCTB ingress line |

Number list shows: owner agent, ingress product (MCTB vs AI receptionist), blocked reasons (non-Telnyx, released, etc.).

### Answering behavior (hidden for CFNA after-hours preset)

| Ring behavior | Effect |
|---------------|--------|
| Answer every incoming call | `ai_immediate` / every_call |
| Ring team first then AI | `ring_team_first` + ring duration |
| After-hours only | `after_hours` |
| When line is busy | `line_busy` |
| Custom schedule | `custom_schedule` |

### Settings

| Control | Options / purpose |
|---------|-------------------|
| Ring team for | 10–45 seconds (overflow) |
| Call recording | All / inbound only / off |

### While the receptionist connects (connection greeting)

Plays **before** AI speaks (session warmup).

| Mode | Purpose |
|------|---------|
| None | Skip |
| Transovo professional / warm | Preset TTS copy |
| Upload custom | HTTPS audio URL |
| Create custom | Custom text TTS |

Editable connection greeting text; preview call flow sidebar (inbound → greeting → AI → book or message/transfer).

### Readiness strip (Opus)

Phone number, inbound calling, AI voice (optional), call recording (optional).

**Runtime:** `phoneNumberId` required for activate; assigns DID to agent; separate from carrier forwarding verification (MCTB path).

---

## Screen 3 — Information (`step=information`)

**Job:** **Business knowledge** and identity inputs that feed prompts, KB, and hours — not booking mechanics.

### Knowledge source (pick one primary path)

| Source | What user does |
|--------|----------------|
| Import from website | URL → crawl/index (business, hours, services, pricing items) |
| Guided business profile | Manual fields: business name, address, hours, services, policies, etc. |
| Upload documents | PDF/DOC/TXT/MD upload into KB |
| Connect existing data | Attach existing `VoiceKnowledgeBase`; links to Integrations / `/voice/knowledge` |

### Knowledge items list

Review/edit items: business details, hours, services, pricing, FAQs, etc.  
Statuses: complete, warning, missing, extracted, owner approved, etc.

### Business schedule / timezone

- Weekly hours editor (`BusinessScheduleEditor` / operating maturity)  
- Workspace timezone for booking and “after hours” behavior  

### Agent / business identity (also duplicated on Voice step in Opus)

| Field | Purpose |
|-------|---------|
| Business name | Prompt + `{{businessName}}` in greeting |
| Agent name | Spoken identity |
| Role | e.g. appointment booking agent, front desk |
| Tone / speaking style / language | Style instructions |
| Opening greeting | First spoken line (`{{agentName}}`, `{{businessName}}`) |
| Long-term memory toggle | Caller memory across calls |
| CRM enabled | CRM note/contact tools with messages |
| Custom guardrails | Extra text rules (plus mandatory guardrails on save) |
| Knowledge base enabled (RAG) | Large-doc search alongside structured items |

### Operational extras (inline, Opus)

| Panel | Purpose |
|-------|---------|
| Knowledge gaps | Dismiss/resolve gaps from ops |
| Knowledge sources | Recrawl website, upload more files |

**Save weight:** Heavy — KB processing/crawl often runs (slow saves).

**Overlap:** `/voice/knowledge` can save same step id `information`.

---

## Screen 4 — Appointments (`step=appointments`)

**Shown only if** booking capabilities enabled on Goals.

**Job:** **How** appointments are handled — calendar connection, strategy, types, fields, qualification.

### Calendar connection (provider grid)

Connect / OAuth / create calendar rows for providers such as:

- Microsoft 365 / Google (live calendar)  
- Calendly (event type URI, timezone)  
- Transovo calendar / other integration paths via `/api/integrations/calendars`  

Shows connection status, email/label, link to Integrations.

### When someone wants an appointment (`bookingStrategy`)

| Strategy | UI label | Runtime |
|----------|----------|---------|
| `MICROSOFT_365` | Book an appointment for them | Live availability + book on call |
| `REQUEST_ONLY` | Take preferred time; team confirms | Collect request, no live book |
| `SEND_LINK` | Send booking link | SMS link + consent + sender picker |
| `NONE` | Message / follow up | No appointment pipeline |

**Send link extras:** booking URL, SMS sender (platform toll-free or explicit A2P number), consent before send, message preview, optional link label.

### Appointment types

Per-type editor: name, duration, calendar, location, modality (in person/phone/video), booking hours, min notice, max days ahead, required fields, booking permission (book directly / suggest / link / etc.), enabled flag. Add/remove types.

### What Amy must collect (`collectFields`)

Enable/require intake fields (name, phone, email, etc.); mark fields for **qualification** rules.

### Qualification (when enabled)

Rules, zip codes, match mode ALL/ANY, fallbacks when not qualified / needs review.

### Side panel

Appointment tools summary, calendar connection status.

**Runtime:** Upserts `VoiceService` rows; enables FIND/BOOK tools per strategy; activation checks calendar/link/SMS readiness.

---

## Screen 5 — Call Handling (`step=call-handling`)

**Job:** Transfers, messages, notifications, spam, operating maturity, booking conversation toggles, AI call recovery SMS.

### Booking behavior (if booking capabilities)

| Toggle | Effect |
|--------|--------|
| Ask preferred day first | Day before slots |
| Offer earliest 3 appointments | Soonest slots |
| Confirm before booking | Verbal confirm |
| Send SMS after booking | Auto confirmation text |
| (Also) ask service first / new vs existing | Intake ordering (in state; may appear in extended UI) |

Visual flow strip: understand → type → collect → availability → offer → confirm → book → confirm SMS.

### Emergency & human transfer

- Transfer destinations (label + E.164, enabled)  
- Warm transfer, voicemail detection on transfer leg  
- Transfer triggers list (policy when transfer allowed)  
- Waterfall routing / transfer plan steps (advanced)  
- Caller-requested transfer toggle  
- MCTB-only: urgency rules, sales/solicitation handling  

### Messages & callbacks

- Take messages and callback requests (on by default)  
- Required callback fields editor (which collect fields mandatory)  
- ANI default, preferred time, confirm number options (in state)

### After-hours notifications

Staff SMS/email on configured call outcomes; recipient list.

### AI Call Recovery

Text caller when AI ends without resolution:

- Enable toggle  
- Consent mode: disabled / existing consent / platform-captured  
- Continue same conversation over SMS (transcript carryover)  
- Send delay: 0 / 15 / 30 seconds  

### Spam / unwanted calls (Opus)

Spam-likely and solicitor policies.

### Operating maturity editors

- After-hours **behavior** (what agent does outside hours)  
- On-call schedule  
- Callback SLA  

### Operational extras

Links/panels to related ops surfaces (call-handling connected shell).

**Overlap:** `/voice/call-handling` saves same wizard state with `wizardStepId: call-handling`.

---

## Screen 6 — Voice (`step=voice`)

**Job:** **Spoken identity**, **GPT-Live voice**, **conversation style**, **opening greeting** (Opus uses `IdentityConversationStage` layout).

### Identity

| Field | Purpose |
|-------|---------|
| Agent name | Spoken name |
| Role | Dropdown (booking agent, front desk, coordinator, assistant) |
| Business name | Spoken context |

### Voice picker

Built-in GPT-Live voices (catalog from `VOICE_V3_WIZARD_LIVE_VOICES`): select voice, preview via `/api/voice/tts-preview`, optional custom OpenAI voice ID (feature flag).

### Conversation style (GPT-Live prompt controls)

| Control | Options |
|---------|---------|
| Speaking pace | Slower / normal / faster |
| Accent / dialect | Neutral American, Southern US, British, Irish |
| Backchannels | None / minimal / natural |
| Pause patience | Quick / normal / patient |
| Interruption behavior | Natural / yield immediately |

### Greeting

Opening greeting textarea with `{{businessName}}` / `{{agentName}}` interpolation; speaks-first mode in legacy layouts.

### Side panel

Voice settings tips, selected voice summary.

**Note:** Identity/greeting also editable on Information — last save wins **per step merge**, not per field globally.

---

## Screen 7 — Test (`step=test`)

**Job:** Try **draft** config without publishing.

| Mode | What it does |
|------|----------------|
| Test in browser | WebRTC `VoiceV3BrowserCall` against draft agent |
| After activate (phone) | Instructions to PSTN test assigned number |

| Action | Purpose |
|--------|---------|
| Save draft for test / Build & start live test | `ensureAgentForTest` → draft save + live probe |
| Shows | Selected voice, draft live test status |

**Test scenarios (legacy picker / guidance):** business question, price question, appointment booking, no availability, transfer, frustrated caller, tool failure — each with sample caller prompt and expected outcomes.

**Does not** publish; failures often infra (LiveKit, internal APIs).

---

## Screen 8 — Activate (`step=activate`)

**Job:** Readiness review + **go live**.

| Block | Purpose |
|-------|---------|
| Title / description | Publish warning: next routed call uses new config |
| Solution name summary | What is being activated |
| Needs attention | Blocking + warning issues from `getWizardActivationIssues` |
| Readiness rows | Phone, voice, greeting, business name, KB, calendar, transfer, etc. |
| Side panel | Phone, business hours summary, agent name |
| **Activate** button | `activationMode: activate_now` → full publish (Telnyx/LiveKit, ACTIVE version) |
| Test in browser first | Jump back to Test step |

**Typical blocking checks:** phone assigned, agent name, voice, opening greeting, business name, knowledge source requirements, transfer numbers if transfer enabled, calendar if Microsoft booking, booking URL + SMS sender if send link, etc.

**On success:** Redirect to `/voice/receptionist` (Opus).

---

## Related old-app surfaces (not the 8 wizard steps)

| Route | Relationship |
|-------|----------------|
| `/voice/overview` | Voice hub KPIs; links to receptionist |
| `/voice/knowledge` | Day-2 KB editor; can save wizard `information` fields |
| `/voice/call-handling` | Day-2 transfer/booking behavior; same state |
| `/voice/knowledge`, `/integrations` | Calendar and CRM connections |
| `/voice/agents/*` | Legacy generic receptionist editor (separate product path) |

---

## Capability → runtime (quick map)

| User-facing capability | Runtime / tools (high level) |
|------------------------|------------------------------|
| Answer questions | KB + prompt sections |
| Book / reschedule / cancel | Calendar strategy + voice tools |
| Take messages | Callback/message tools |
| Qualify callers | Collect fields + qualification rules |
| Transfer calls | Transfer destinations, warm transfer, escalate |
| Send SMS confirmations | Outbound SMS + A2P sender |

---

## Document metadata

- Generated for **new-app rebuild planning** from legacy Transovo SMS repo.  
- Authoritative implementation audit: `docs/AI-RECEPTIONIST-WIZARD-RUNTIME-AUDIT.md`  
- Step IDs: `src/lib/solutions/appointment-receptionist/types.ts` (`WIZARD_STEPS`)
