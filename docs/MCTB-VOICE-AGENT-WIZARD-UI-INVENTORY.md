# MCTB Voice Agent — Wizard UI inventory (all screens)

**Route:** `/mctb/voice-agent`  
**Product context:** MCTB feature switcher → **Voice Agent** (not legacy Solutions `/voice/agents` hire flow).  
**Wizard component:** `AppointmentReceptionistWizard` with `presentation="mctb"`.  
**Source of truth (code):** `src/components/mctb/voice-agent/*`, `src/components/solutions/appointment-receptionist/steps/*`, `src/lib/mctb/voice-agent/wizard-steps.ts`.  
**Generated:** 2026-09-22 — inventory from production UI code paths (not a live browser scrape).

---

## How many steps?

The product defines **8 canonical wizard step IDs**. MCTB stepper labels:

| # | Step ID | MCTB label | URL `?step=` |
|---|---------|------------|--------------|
| 1 | `goals` | Purpose | `goals` |
| 2 | `phone` | Phone | `phone` |
| 3 | `information` | Business Knowledge | `information` |
| 4 | `appointments` | Booking | `booking` |
| 5 | `call-handling` | Call Handling | `call-handling` |
| 6 | `voice` | Voice | `voice` |
| 7 | `test` | Test | `test` |
| 8 | `activate` | Activate | `activate` |

**Booking step visibility:** Step 4 is **hidden** unless the agent has a booking capability (`book_appointments`, `reschedule`, or `cancel`). Default MCTB state uses preset `after_hours`, which **initializes** `book_appointments` in wizard state, so **Booking usually appears** until the user turns booking off via Purpose capabilities or chooses booking strategy `NONE`.

**Default MCTB agent name:** `After-Hours Voice Agent` (page H1 follows `solutionName`).

---

## Page chrome (above the wizard)

### MCTB page header

| Element | Type | Copy / behavior |
|---------|------|-----------------|
| Page title (H1) | Text | Agent `solutionName` (default **After-Hours Voice Agent**) |
| Status pill | Badge (conditional) | **Active** \| **Draft** \| **Needs attention** |
| Subtitle | Text | “Answer missed and after-hours calls with an AI agent that follows your business rules.” |
| **Test agent** | Button (outline) | Scrolls to wizard footer **Continue** (`data-testid="wizard-continue"`) |

### Call handling card (`CallHandlingModeSwitch`)

| Element | Type | Copy / behavior |
|---------|------|-----------------|
| Eyebrow | Text | **CALL HANDLING** |
| Current mode title | Text | **After-Hours Voice Agent** or **Missed Call Text Back** |
| Mode description | Text | Voice Agent: “Forwarded calls are answered by your AI agent on the same Transovo number.” / MCTB: “Forwarded calls use your existing Press-1 / recovery flow.” |
| Forwarding line | Text (conditional) | **Forwarding:** Already connected \| Pending verification · Business line · Transovo number |
| Helper note | Text | “Already using Missed Call Text Back? Your current forwarding setup works with Voice Agent too — you don't need to change anything with your carrier.” |
| **Turn on Voice Agent** | Primary button | Shown when mode is MCTB; disabled until `agentReady` (active agent); confirm dialog before PATCH |
| **Switch to Missed Call Text Back** | Outline button | Shown when Voice Agent mode is on; confirm dialog |
| **Finish setup to enable** | Link | To `?step=activate` when agent not ready |
| Error | Alert text | API / switch failures |

---

## Wizard chrome (all steps)

| Element | Type | Copy / behavior |
|---------|------|-----------------|
| Mobile step indicator | Text (`aria-live`) | “Step N of M · {label}” |
| **Wizard stepper** | Horizontal step nav (MCTB clickable) | Purpose → Phone → Business Knowledge → Booking* → Call Handling → Voice → Test → Activate |
| Step readiness | Per-step status dots | From `computeMctbWizardStepReadiness` |
| **Back** | Button | Previous step |
| **Save** | Button | Persists draft (`save_draft`) |
| **Continue** | Primary button | Next step; on last step label depends on activation mode (see Activate) |
| Footer error | Text | API / validation errors |

---

## Step 1 — Purpose (`goals`)

### Main column

| Element | Control | Label / title | Notes |
|---------|---------|---------------|-------|
| Agent name | Text input (`solution-name`) | **Agent name** | Placeholder: “e.g. Front Desk — Main Office”. Helper: “This name shows in Your Team and Automations…” |
| Section H2 | Heading | **What should your voice agent handle?** | |
| Section helper | Text | “Choose what the agent is allowed to help callers with.” | |
| Capability cards | **Multi-select** `SelectableCard` (toggle each) | Only options allowed for `after_hours` preset (see table below) | Each card: title + description + icon |
| Section H3 | Heading | **When should this agent answer?** | |
| Answer-when rows | **Single-select** `RadioRow` | Only 3 options for `after_hours` preset (see table) | Updates `answerWhen` + `ringBehavior` |

#### Capability cards (MCTB `after_hours` allowlist)

| ID | Title | Description |
|----|-------|-------------|
| `answer_questions` | Answer common questions | Hours, services, pricing, policies, and directions. |
| `take_messages` | Take messages | Capture caller details when a person isn't available. |
| `qualify_callers` | Qualify new callers | Ask screening questions before booking or transfer. |
| `transfer_calls` | Transfer calls | Hand off to a person when needed. |
| `send_sms_confirmations` | Send confirmations by text | SMS confirmations and reminders after booking. |

*Not shown on Purpose for this preset:* Book new appointments, Reschedule, Cancel (those appear in full booking wizard / other presets).

#### When should this agent answer? (`after_hours` preset)

| ID | Label | Description |
|----|-------|-------------|
| `after_hours` | Only after business hours | AI covers nights, weekends, and holidays. |
| `custom_schedule` | According to a custom schedule | Ring your team during business hours, then AI after hours (uses your workspace business hours). |
| `every_call` | Every incoming call | AI answers immediately on this number. |

### Side panel — **Agent summary**

| Line | Content |
|------|---------|
| Purpose | After-hours call recovery (static copy) |
| Enabled capabilities | Count of selected capabilities |
| Policy source | AI Lead Recovery (static) |
| Booking | Available \| Off (from `book_appointments` capability) |
| Transfer | Ready \| Needs setup \| Off (transfer capability + phone configured) |

---

## Step 2 — Phone (`phone`)

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **Where should the agent answer?** |
| Readiness chips (4) | Status display | **Phone number** (Ready/Needed) · **Inbound calling** (Ready) · **AI Voice** (Ready) · **Call recording** (Ready/Optional) |
| MCTB info callout | Callout (if MCTB line loaded) | **Your business line is already connected** + forwarding summary + Transovo number + forwarding status |
| Number source cards | **Single-select** cards | See below |
| Buy-new helper | Panel + link | **Buy a number in Numbers** → **Open My Numbers** (`/my-numbers`) |
| Forward-existing helper | Ordered list + number pickers | **Forward your carrier number to Transovo** (3 steps) + per-number **Forward to {E.164}** buttons |
| Existing number list | **Single-select** buttons | Each row: formatted number, friendly name, status lines (MCTB TeXML, other AI owner, available, etc.) |
| Info callouts | Text | Switching from another AI agent; MCTB TeXML ingress warning; softphone assignment warning |
| H3 | Heading | **Answering behavior** |
| Ring behavior | **Single-select** `RadioRow` | Answer every incoming call · Ring team first then use AI · After-hours only · When the line is busy · Custom schedule |
| H3 | Heading | **Settings** |
| Ring team for | `<select>` | 10, 15, 20, 30, 45 seconds |
| Call recording | `<select>` | Record all calls · Inbound only · Off |
| H3 | Heading | **While the receptionist connects** |
| Connection greeting | **Single-select** `RadioRow` | No connection greeting · Transovo professional greeting · Transovo warm greeting · Upload custom greeting · Create custom greeting |
| Preview | Button + text | **Preview connection greeting** (browser TTS play) |
| Greeting audio URL | URL input (if upload custom) | **Greeting audio URL (HTTPS MP3/WAV)** |
| Greeting text | Textarea or read-only quote (if greeting ≠ none) | **Custom greeting text** / **Greeting text** |

#### Number source cards (MCTB)

| Card | When shown | Title | Description |
|------|------------|-------|-------------|
| Use existing MCTB line | If inbound-handling API returns ingress | **Use existing MCTB line** | Recommended — same forwarding as missed-call recovery |
| Use existing Transovo number | Always | **Use existing Transovo number** | Pick workspace number or “No numbers yet…” |
| Buy a new number | Always | **Buy a new number** | Get local or toll-free |
| Forward an existing business number | Always | **Forward an existing business number** | Keep current number, route to Transovo |

### Side panel — **Phone setup**

| Element | Content |
|---------|---------|
| Selected number | Formatted E.164 + **Ready** / **Needed** pill |
| **Call flow preview** | Ordered list (varies if booking capability): Inbound call → Connection greeting → AI agent answers → (Books + Confirmation) OR (Take messages/transfer + End call) |
| Info callout | Activate publishes to Telnyx, connection greeting while AI initializes |

---

## Step 3 — Business Knowledge (`information`)

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **Business Knowledge** |
| Intro | Text | Facts written into agent knowledge on save/activate |
| Document search | **Checkbox** | **Search uploaded documents during calls** (+ helper paragraph) |
| Warning | Text (conditional) | Large document search off / need upload or website to enable search |
| Knowledge source | **Single-select** cards (4) | See below |
| Website panel | URL input + **Scan** button | **Business website URL** |
| Guided profile panel | Text inputs + textareas + **Save profile to knowledge** | Business name, Address/locations, Business hours, Services, Pricing (optional), Policies (optional) |
| Upload panel | File picker (hidden) + drop zone button | **Upload knowledge files** (PDF, DOCX, TXT, MD, CSV) |
| Connect data panel | See Connect existing knowledge | |
| Knowledge items list | Rows per item | Label, summary, status pill, **Approve** (if pending), edit (pencil) |
| **Approve all imported facts for shared brain** | Button (conditional) | |
| Edit modal | Modal | **Edit knowledge item** — Label, **Facts the agent should know**, Cancel, Save |
| **Business hours & holidays** | Section (`BusinessScheduleEditor`) | See sub-section |

#### Knowledge source cards

| Source | Title | Description |
|--------|-------|-------------|
| `website` | Import from your website | Scan your site for services, hours, FAQs, and more. |
| `guided_profile` | Complete guided business profile | Enter hours, services, pricing, and policies. |
| `upload_docs` | Upload documents | PDF, DOCX, TXT, MD, CSV — indexed into agent knowledge. |
| `connect_data` | Connect existing data | Attach existing knowledge base or open Integrations. |

#### Default knowledge item rows (list)

| Label | Typical status |
|-------|----------------|
| Business details | Not configured |
| Hours | Not configured |
| Services | Not configured |
| Pricing | Not configured |
| FAQs | Not configured |
| Policies | Not configured |

*Additional rows may appear after website scan / upload (e.g. linked knowledge base).*

#### Connect existing knowledge (when source = connect_data)

| Element | Type |
|---------|------|
| Title | **Connect existing knowledge** |
| Knowledge base | `<select>` **Select a knowledge base…** |
| **Open Integrations** | Link button → `/integrations` |
| **Open Knowledge bases** | Link button → `/voice/knowledge` |

#### Business hours & holidays (bottom of step)

| Element | Control |
|---------|---------|
| H3 | **Business hours & holidays** |
| Helper | Used for after-hours operating state; does not change phone routing |
| Timezone | Text input **Timezone** (e.g. America/New_York) |
| Weekly schedule | Per weekday: **Closed** checkbox; if open: start/end **time** inputs |
| Holiday closures | Per holiday: name, date, **Remove**; **Add holiday** |

### Side panel — **Knowledge quality**

| Element | Content |
|---------|---------|
| Checklist | Each knowledge item with ✓ or ⚠ and helper text |
| Info callout | Facts written to agent KB on save/activate for Telnyx |

---

## Step 4 — Booking (`appointments`)

*Hidden unless booking capability is on.*

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **Booking** |
| Intro | Text | Choose scheduling mode; connections in Integrations |
| Provider cards (MCTB) | **SelectableCard** (2) | **Microsoft Calendar** · **Calendly** — status: Connecting… / Connected / Connect in Integrations |
| Section label | Text | **WHEN SOMEONE WANTS AN APPOINTMENT** |
| Booking strategy | **Single-select** `RadioRow` (5) | See table |
| Calendly sub-panel | Info, event type `<select>`, helper text | When strategy = Calendly |
| Send link sub-panel | URL, SMS sender, consent checkbox, message preview, link label | When strategy = SEND_LINK |
| **Appointment types** | Table + **Add appointment** | Columns: Appointment (enable checkbox + name), Duration, Calendar, Status, actions menu icon |
| **Appointment configuration** | Panel (when row selected) | Close (X) |

#### Booking strategy radios

| Strategy | Label | Description |
|----------|-------|-------------|
| `MICROSOFT_365` | Book an appointment for them | Live Microsoft 365 availability + book on call |
| `CALENDLY` | Book appointments with Calendly | Real Calendly availability (paid plan) |
| `REQUEST_ONLY` | Take their preferred time and have us confirm it | Team confirms later |
| `SEND_LINK` | Send our booking link | Text a self-serve link |
| `NONE` | Take a message / have us follow up | Not an appointment flow |

#### Send booking link fields (strategy = SEND_LINK)

| Field | Type |
|-------|------|
| Booking URL * | URL input |
| Text message sender * | `<select>` SMS-enabled numbers |
| Ask for permission before sending | Checkbox |
| Message preview | Read-only SMS preview block |
| Link label (optional) | Text input |

#### Calendly fields (strategy = CALENDLY)

| Field | Type |
|-------|------|
| Plan blocked callout | InfoCallout (if applicable) |
| Calendly event type | `<select>` **Select event type…** |

#### Appointment configuration (selected type)

| Section | Fields |
|---------|--------|
| Appointment details | **Appointment name**, **Duration** (15–90 min), **Assigned staff / calendar** |
| Booking settings | Booking hours (display), **Minimum notice** (1h–1 day), **Maximum days ahead** (14–90 days) |
| Caller qualification | **Enable caller qualification** checkbox; if on: require before booking/link, ZIP codes, rule builder (**Add rule** / per-rule fields / **Remove rule**) |
| What Amy must collect | Per-field: enable checkbox, **Required**, **Qualification** (if qual on), **Remove** (custom fields); **New field label** + **Add field** |
| Booking permissions | **Single-select:** Book directly · Suggest times first · Send booking link |

### Side panel — **Appointment tools**

| Element | Content |
|---------|---------|
| Bullet list | Check availability · Book appointment |
| Calendar connection | Provider + email or “No calendar connected yet” + Connected/Needed pill |
| Info callout | Real-time calendar booking |

---

## Step 5 — Call Handling (`call-handling`)

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **How should your agent handle calls?** |
| Intro | Text | Transfers, messages, (+ booking behavior if booking on) |
| Flow strip (MCTB) | 5 numbered chips | Understand request → Apply business policy → Collect what's needed → Perform allowed action → Confirm or hand off |
| **Booking behavior** | Card (if booking) | 4 checkboxes: Ask preferred day first · Offer earliest 3 · Confirm before booking · Send SMS after booking |
| **Emergency & human transfer** | Card | Policy triggers line (read-only list) + `EmergencyTransferEditor` + MCTB-only urgency/solicitation |
| **Messages & callbacks** | Card | Take messages checkbox + `CallbackRequiredFieldsEditor` |
| **After-hours notifications** | Card | `AfterHoursNotificationsEditor` |
| **AI Call Recovery** | Card | Enable + messaging permission + continue over SMS + send delay |
| **Other call handling** | Card | Long-term memory · Enable CRM tools (conditional) |
| **After-hours behavior** | Section | `AfterHoursBehaviorEditor` |
| **On-call schedule** | Section | `OnCallScheduleEditor` |
| **Callback SLA** | Section | `CallbackSlaEditor` |

#### Emergency & human transfer (embedded editor)

| Element | Control |
|---------|---------|
| Helper | After-hours escalation copy |
| **Enable emergency & human transfer** | Checkbox |
| **Allow caller-requested human** | Checkbox |
| **Routing** | Select: Single destination \| Waterfall |
| **Default ring timeout** | Select: 5–120 seconds (9 options) |
| **Transfer contacts** | **Add contact**; per contact: reorder (waterfall), display name, phone, **Transfer mode** (Direct/Warm), **Ring timeout**, remove |
| **Detect voicemail on transfer** | Checkbox |
| **If nobody answers** | **Single-select** radio: Return caller to AI · Take a message · Notify staff |
| Validation list | Amber issues (if any) |
| If transfer capability off | Message: turn on **Transfer calls** on Purpose |

*Displayed policy triggers (default):* Caller asks for a person · Caller is frustrated · Urgent issue · Agent cannot help

#### MCTB-only (under Emergency card)

| Element | Control |
|---------|---------|
| **Urgent-call handling** | Checkbox → `UrgencyRulesEditor` when on |
| **Sales / solicitation handling** | Checkbox |

#### Urgency rules (when enabled)

| Per rule | Controls |
|----------|----------|
| | **When field** (select from intake fields), **Operator** (equals, contains, is one of, …), **Value**, **Severity** (Urgent/Critical), **Action** (Transfer, Callback, Take message, …), Transfer plan + Fallback (if Transfer), **Label**, **Delete rule** |
| | **+ Add rule** |

#### Messages & callbacks

| Element | Control |
|---------|---------|
| **Take messages and callback requests** | Checkbox (default on) |
| **Required before recording a callback** | Checkboxes per enabled collect field + **Reset to recommended defaults** |

#### After-hours notifications

| **Send notifications for** | Each event: **SMS** + **Email** checkboxes |
| Events | Messages & callback requests · Emergency calls · Failed emergency transfers · Successful emergency transfers · Appointment bookings · Appointment changes · Every completed call |
| **Notify** | Per recipient: Label, Enabled, SMS (E.164), Email; **+ Add recipient** |

#### AI Call Recovery

| Element | Control |
|---------|---------|
| Master checkbox | **Text callers when an AI conversation ends before their request is resolved** |
| Messaging permission | Select: Disabled · Existing consent · Platform-captured consent |
| Continue conversation by text | Checkbox |
| Send delay | Select: Immediately · 15s · 30s |

#### Other call handling

| Checkbox | Label |
|----------|-------|
| | **Long-term caller memory** |
| | **Enable CRM tools** (if booking or qualify capability) |

#### After-hours behavior

| Checkbox | Label |
|----------|-------|
| | **Apply operating state during live calls** |
| | Allow live booking · Allow callback requests · Allow message taking · Allow on-call escalation · Allow office transfer when closed · Allow normal transfer destinations |

#### On-call schedule

| Element | Control |
|---------|---------|
| **Enable on-call rotation** | Checkbox |
| Per entry | Label, day-of-week number, start/end time, on-call phone, **Remove entry** |
| | **Add on-call window** |

#### Callback SLA

| Select | Options |
|--------|---------|
| Normal callbacks | 30 minutes · 1 hour · Next business day · Custom |
| Urgent callbacks | Immediate · 15 minutes · 30 minutes · Custom |

### Side panel — **Call handling preview**

| Element | Content |
|---------|---------|
| Flow list | Non-booking: Greet → Answer from knowledge → Take message → Transfer → Confirm next steps (booking uses 8-step booking flow list) |
| Status rows | Emergency transfer Ready/Needed · SMS confirmations Off/Pending A2P · Staff notification Enabled |
| Info callout | Settings editable after activation |

---

## Step 6 — Voice (`voice`)

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **How should your agent sound?** |
| Intro | Text | Identity, greeting, voice; preview then test on next step |
| **Identity** | Card | See table |
| **Choose a voice** | Card | Grid of GPT-Live voices + prompt controls |

#### Identity fields

| Field | Control | Options / notes |
|-------|---------|-----------------|
| Agent name | Text input | |
| Business name | Text input | Placeholder: Your business |
| Role | Select | Front-desk receptionist · Appointment coordinator · Office assistant |
| Tone | Select | Warm and professional · Friendly and upbeat · Calm and supportive · Crisp and efficient |
| Speaking style | Select | Brief and conversational · Detailed and thorough · Casual and approachable |
| Language | Select | English · Spanish · French |
| **Greeting behavior** | Radio | AI speaks first · Caller speaks first |
| Opening greeting | Textarea | Max 500 chars; shows preview with `{{businessName}}` / `{{agentName}}` |
| **Conversation behavior** | Toggle switches (5) | Keep answers brief · Ask one question at a time · Confirm names and numbers · Never invent pricing · Never invent availability |

#### Voice picker (22 GPT-Live built-in voices)

Each voice card: **title** (capitalized id), **description**, badge (**Recommended** on Marin, else **GPT-Live**), **Play** sample button.

Voice IDs: alloy, ash, ballad, beacon, bossa, cedar, cinder, coral, delta, echo, gleam, **marin** (recommended default), meridian, quartz, ripple, sage, shimmer, stone, tempo, verse, vesper, willow.

#### GPT-Live prompt controls (below voice grid)

| Select | Options |
|--------|---------|
| Speaking pace | Slower · Normal · Faster |
| Accent / dialect | Neutral American · Southern US · British English · Irish English |
| Backchannels | None · Minimal · Natural |
| Patience when caller pauses | Quicker check-ins · Normal · Very patient |
| When caller interrupts | Natural rhythm · Yield immediately |

*Optional (env flag `NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD=1`):* **Authorized custom OpenAI voice ID** text input.

### Side panel — **Voice settings**

| Element | Content |
|---------|---------|
| Voice summary | Selected voice label + badge |
| Tone line | Current tone |
| Info callout | Next step = live WebRTC test with same assistant as PSTN |

---

## Step 7 — Test (`test`)

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **Test your voice agent** |
| Intro | Text | Try scenarios before customer calls |
| **Test scenarios** | **Single-select** `SelectableCard` list | Filtered by capabilities (see below) |
| Expected outcomes | Bullet list | Per selected scenario |
| Try saying | Hint text | Quoted scenario prompt |
| Test mode tabs | **Single-select** | Test in browser · Call my phone · Call the agent |
| **Save draft for test** | Button | |
| **Mark scenario checked** | Button | Sets scenario tools checklist + `lastTestPassed` when draft exists |
| Browser test area | `VoiceV3BrowserCall` or empty state | **Build & start live test** / **Start V3 live test** / **End call** |
| Phone modes | Info panel | Copy for PSTN test after activate; shows assigned number if set |
| Scenario tools checklist | List (after mark) | e.g. Search knowledge, Transfer, Calendar tools |

#### Test scenarios (non-booking default set)

| ID | Title | Sample prompt | Expected outcomes (bullets) |
|----|-------|---------------|----------------------------|
| `business_question` | Business question | What time do you close on Saturday? | Retrieves business hours; Does not invent an answer |
| `price_question` | Price question | How much is the initial consultation? | Uses knowledge base; Offers booking when appropriate |
| `transfer` | Transfer request | I want to speak to the owner. | Collects reason; Attempts transfer; Runs fallback |
| `frustrated` | Frustrated caller | You're not helping me. Get me a person. | Does not argue; Transfers or takes a message |

*Additional scenarios when booking capability on:* Appointment booking · No availability · Tool failure (see `TEST_SCENARIOS` in defaults).

#### Voice V3 live browser test widget

| Element | Content |
|---------|---------|
| Title | **Voice V3 live browser test** |
| Subtitle | OpenAI GPT-Live + Astra delegation — draft wizard config · {voiceLabel} |
| Buttons | **Start V3 live test** / **Connecting…** / **End call** |
| Probe details (after connect) | source, configVersion, agentName, liveVoiceId, session id, models, intakeFieldKeys |

### Agent Quality Studio (card beside main column, not side panel)

| Element | Control |
|---------|---------|
| Title | **Agent Quality Studio** |
| Description | Headless scenario suite (no PSTN) |
| **Run Quality Studio** | Button (shows deprecation message pointing to PSTN / npm cert scripts) |
| Last run timestamp | If present in state |

### Side panel — **Test summary**

| Block | Content |
|-------|---------|
| Selected voice | `voiceLabel` |
| V3 live test | OpenAI Live (draft) / Ready / Save draft first |
| Average response latency | — (measured during live call) |
| Tool success rate | — (from live tool log) |
| Scenario checklist | Checked / Not run + scenario title |

---

## Step 8 — Activate (`activate`)

### Main column

| Element | Control | Label / title |
|---------|---------|---------------|
| H2 | Heading | **Ready to turn on your voice agent?** |
| Intro | Text | Review blockers before agent answers calls |
| Summary card | Text | `{solutionName}` + capability summary paragraph |
| **Activation checklist** | Issue list (if any) | Required / Warning messages from `getWizardActivationIssues` |
| Readiness grid | Status pills | See checklist table |
| **Your receptionist will** | Ordered list | From `buildReceptionistWillList(state)` |
| **Activation options** | **Single-select** cards (4) | See table |
| Schedule datetime | `datetime-local` input | **Go live at** (if Schedule activation selected) |

#### Activation readiness grid (labels)

Phone number · Receptionist name · Business information · Voice · Opening greeting · (Calendar · Appointment type if booking) · (Transfer destination if transfer) · Test call · Recording disclosure · Message taking + notify · Post-call summary · Time zone

#### Activation option cards

| Mode | Title | Description |
|------|-------|-------------|
| `activate_now` | Go live immediately | Publish on this number as soon as you confirm |
| `schedule` | Schedule activation | Pick date and time |
| `save_draft` | Save as draft | Keep editing without answering calls |
| `duplicate_location` | Duplicate for another location | Clone for second office |

### Side panel — **Deployment**

| Element | Control |
|---------|---------|
| Phone number | Display |
| Active schedule | Mon – Fri, 8:00 AM – 6:00 PM ({timezone}) |
| AI receptionist | `agentName` |
| **Activate now** | Primary button (`data-testid="wizard-activate-submit"`) — disabled if blocking issues and mode is activate_now |
| **Run final test** | Button → jumps to Test step |
| Info callout | What activate publishes (knowledge, transfers, services, summaries, alerts) |

### Footer primary on last step

Depends on `activationMode`: **Activate now** · **Schedule activation** · **Save draft** · **Activate & duplicate** (MCTB uses **Save** not “Save draft” on secondary button).

---

## Appendix — Related routes & APIs (not on-screen inventory)

- Deep link: `/mctb/voice-agent?step={goals|phone|information|booking|call-handling|voice|test|activate}&agentId=…`
- Draft persistence: `/api/solutions/appointment-receptionist`, localStorage key `transovo.mctb.voice-agent.wizard.v1`
- Inbound mode switch: `PATCH /api/mctb/inbound-handling`

---

*End of inventory.*
