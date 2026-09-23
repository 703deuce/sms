# Smith.ai vs Rosie vs Transovo — Receptionist Dashboard Comparison

**Purpose:** Benchmark Transovo’s AI receptionist / call-handling customer experience against Smith.ai (human virtual receptionist) and Rosie (AI receptionist), without copying either 1:1.

**Context:** Post–PR #484, MCTB simplified launch is merged; this document is about the **receptionist / AI after-hours** product surface and how it relates to MCTB. PLATFORM/CUSTOMER sender mode is out of scope here.

**How to use this doc:**

- **Smith** = functional benchmark (what capabilities exist in a mature receptionist portal).
- **Rosie** = UX compression benchmark (how much can live under a small nav).
- **Transovo** = one **Business Operating Profile** with execution modes **AI | Human | Hybrid** (human/hybrid are future layers—not three separate dashboards).

---

## 1. Navigation shape (how customers find things)

| | **Smith** | **Rosie** | **Transovo (AI receptionist path)** |
|---|-----------|-----------|-------------------------------------|
| **Primary nav** | Call History, Call Handling, Instructions, Integrations, Settings | Quick Start, Conversations, Agent Settings, Integrations, Account | **Product-dependent.** Dedicated **AI After Hours** shell: Overview → AI Agent (About / Capabilities / Integrations / Advanced / Voice & Test) → Calls → Knowledge → Call Handling → Numbers (+ account). **MCTB shell** adds Missed Calls, Conversations (SMS), Setup, and **`/mctb/voice-agent`** (embedded wizard + Call Handling switch). |
| **Mental model** | Ops log + phone/routing page + human playbook | One inbox + one “brief the receptionist” page | **Split:** voice ops under `/voice/*`, missed-call/SMS under `/mctb/*`, shared Numbers/Integrations/Settings. |
| **Rosie-like compression?** | No — many top-level areas | Yes — ~5 items | **Partial.** Wizard on `/mctb/voice-agent` is Rosie-like (train → configure → test → activate), but **day-2 editing** still spreads across agent subpages, Knowledge, inbound routing, and MCTB setup. |

**Takeaway:** Transovo already has **Rosie’s “Agent Settings as wizard”** inside MCTB (`AppointmentReceptionistWizard` with MCTB labels: Purpose, Phone, Business Knowledge, Booking, Call Handling, Voice, Test, Activate). It does **not** yet have Rosie’s single **“Agent Settings” hub with 12 cards + Publish** for ongoing edits. Smith’s **Instructions** as one named object is **not** mirrored in nav; the equivalent is **distributed** (wizard + capabilities + Company Brain + Voice KB).

### Transovo code references (nav)

- AI After Hours nav: `src/lib/products/ai-after-hours-nav.ts`
- MCTB V1 nav: `src/lib/products/mctb-nav.ts`
- MCTB voice agent route: `/mctb/voice-agent` → `src/components/mctb/voice-agent/mctb-voice-agent-page.tsx`
- Legacy `/voice/receptionist` redirects to MCTB setup (not receptionist hub): `src/app/(app)/voice/receptionist/page.tsx`

---

## 2. Smith.ai — documented customer portal (reference inventory)

Smith’s customer-facing Virtual Receptionist portal is centered on:

1. Call History / Dashboard  
2. Call Handling  
3. Instructions  
4. Integrations  
5. Settings  

(Account-level: Billing, Workspace Users, Business Info inside Settings.)

### 2.1 Call History / main dashboard

- Date selector (today, yesterday, week, month, custom, default ~3 months).
- Call intelligence graph by caller type/status (New Lead, Existing Client, Repeat Caller, Attorney/Court Staff, Unknown).
- Filters: status, disposition, priority, actions taken; show spam/blocked.
- Call quota / plan on multi-month views.

### 2.2 Call log

Per-call records: caller, phone, date/time, status, priority, disposition, actions, duration, recording, follow-up. Actions column icons (appointment, transfer, intake, payment, conflict check, follow-up). CSV export.

### 2.3 Call details page

Caller info, metadata, recording, transcript, follow-up message + send time, summary recipients, written call summary, **Call Decisions** (decision path through instructions), actions taken. Caller actions: callback, direct transfer/VIP, voicemail, block.

### 2.4 Call Handling (single large page)

- Smith number (read-only)  
- Transfer lines / destinations  
- Direct transfers (VIP bypass list)  
- Blocked numbers  
- Voicemail greetings  
- Follow-up communication (email/SMS, CC/BCC)  
- Business availability / schedule (timezone, hours, holidays, after-hours instructions, transfer only in-hours)

### 2.5 Instructions

Human receptionist playbook: new leads, existing clients, special caller types, scheduling, transfers, special rules. Connected calendars/billing/intake referenced from Instructions.

### 2.6 Integrations

Marketplace: connect CRM/calendar platforms; status per integration; plan may limit count.

### 2.7 Settings

Account, billing, plan, business info, workspace users (admin vs user permissions).

### 2.8 Campaigns (outbound)

Separate outbound product—not core inbound receptionist IA.

---

## 3. Rosie — documented dashboard (reference inventory)

### 3.1 Primary sidebar (current product)

1. Quick Start Guide  
2. Conversations  
3. Agent Settings  
4. Integrations  
5. Account  

(No separate Analytics, Calls, Phone, Billing, Knowledge in top nav—much lives under Agent Settings or Conversations.)

### 3.2 Quick Start

Train (Google Business Profile, website) → Customize → Test / Talk to Rosie → Launch (forward to Rosie number). Agent Knowledge Summary from scan; customer reviews/edits.

### 3.3 Conversations

Unified inbox: calls + SMS (+ website chat). List: contact, type badges (Appointment, Message, Hang-up), summary band, outcome. Detail: transcript, recording, AI summary, caller info, **outcome cards** (e.g. calendar event link). Search, filters, copy summary. Live takeover (chat).

### 3.4 Agent Settings (12 sections, card + Edit, Publish at top)

1. Business Information  
2. Agent Profile (name, voice, tone, speed, pronunciation)  
3. Greeting  
4. FAQs  
5. Take a Message (scenarios + fields per reason)  
6. Spam Filters  
7. Appointments (calendar integrations)  
8. Text a Link  
9. Transfer Calls (including waterfall on Scale)  
10. Custom Training  
11. Launch Instructions  
12. Website Widgets (chat)

### 3.5 Integrations

Lead sources, CRMs, calendars, Zapier, Shopify; search + filter.

### 3.6 Account

Team, subscription tiers; phone/usage in sidebar area.

---

## 4. Screen-by-screen: Smith → Transovo mapping

| **Smith area** | **Transovo equivalent** | **Match quality** | **Notes** |
|----------------|-------------------------|-------------------|-----------|
| **Call History / dashboard** | `/voice/overview`, `/voice/calls`; MCTB `/mctb`, `/mctb/missed-calls` | **Partial** | Voice overview has KPIs + recent calls; not Smith’s caller-type intelligence graph, disposition/priority filters, or quota strip. MCTB overview is recovery-focused, not receptionist call intelligence. |
| **Call log + CSV** | `/voice/calls` + APIs | **Partial** | List + detail exist; export/CSV and Smith-style disposition columns are not first-class in the same UI. |
| **Call detail** (recording, transcript, summary, follow-up, summary recipients) | `/voice/calls/[id]` | **Good core, gaps on “decisions”** | Recording, transcript, summary, captured fields, action items from tools (`src/lib/voice/calls/detail.ts`). **No Smith-style “Call Decisions”** drill-down of instruction steps. Demo/mock path still exists for some IDs. |
| **Caller actions** (callback, VIP direct transfer, voicemail, block) | Block API (`voice-v3` blocklist), transfer runtime | **Partial** | Block from call detail wired toward V3 blocklist; **VIP/direct transfer** lives in transfer policy / Smart Routing, not Smith-simple on call row. |
| **Call Handling** (number, transfers, direct transfers, blocked, voicemail, follow-up, availability) | Canonical **Call Handling** (MCTB ↔ AI on ingress) + `/voice/inbound-routing` + wizard **Call Handling** step + MCTB voicemail setup | **Fragmented but capable** | **PR #483** canonical switch (`CallHandlingModeSwitch` on `/mctb/voice-agent`). Transfer **waterfall** in Voice V3 config (`transferRouting: "waterfall"`). Availability/after-hours in wizard + routing rules, not one Smith schedule page. |
| **Instructions** (playbook) | Wizard goals/info, **Capabilities**, compiled **agent config**, workflows/tools | **Stronger runtime, weaker “one doc” UX** | Deterministic workflow + tools + escalation—closer to “Business Knowledge + Instructions + Workflow + Tools,” but **not labeled “Instructions”** for customers. |
| **Integrations** | `/integrations` + `/voice/agents/[id]/integrations` | **Good** | Global + per-agent. |
| **Settings** (billing, business info, workspace users) | `/settings/*`, account nav | **Good** | Standard SaaS. |
| **Campaigns (outbound)** | `/voice/campaigns` (legacy/hidden in V1) | **Exists, out of scope** | Not receptionist core. |

---

## 5. Rosie → Transovo mapping

| **Rosie section** | **Transovo** | **Match** |
|-------------------|--------------|-----------|
| **Quick Start** (GBP, website, train → test → launch) | MCTB voice-agent **wizard** + Company Brain hydrate (`hydrate-from-brain`) + `/voice/knowledge` website crawl (V3) | **Strong on train/launch**; Quick Start is not a separate sidebar item—it **is** `/mctb/voice-agent`. |
| **Conversations** (calls + SMS + chat, summary badges, outcome cards) | **SMS:** `/conversations` or `/mctb/conversations`. **Voice:** `/voice/calls` | **Gap:** not one **unified conversation inbox** with Appointment/Message/Hang-up badges. |
| **Business Information** | Company Brain (`business-brain`) + wizard Information step | **Strong**; website ingestion aligned. MCTB FAQ uses **approved** brain slice without V3 RAG (#484). |
| **Agent Profile / Greeting / Voice** | Wizard **Voice** step + agent About; ElevenLabs catalog | **Good** |
| **FAQs** | Brain facts + Voice KB page (RAG) + runtime FAQ capability | **Split** between approved facts and agent KB. |
| **Take a Message** (scenarios + fields) | Intake objectives / dynamic fields / callback required fields in receptionist solution | **Strong architecturally**; UI is wizard/advanced, not Rosie per-scenario cards. |
| **Spam Filters** | `voice-v3/spam-protection`, blocklist APIs | **Present**; not one Rosie-labeled card in MCTB wizard. |
| **Appointments** | Booking strategies (Microsoft, Calendly, send link, request-only) in wizard | **Strong**; MCTB TeXML pipeline frozen separately. |
| **Text a Link** | SMS/link tools in voice runtime | **Runtime yes**; not its own Agent Settings card. |
| **Transfer Calls** (+ waterfall) | V3 `transfer_call`, waterfall in config | **Strong** |
| **Custom Training** | KB uploads, docs, crawl | **Via Knowledge page** |
| **Launch Instructions** | Wizard Phone + activate + MCTB forwarding guides | **Split** between voice-agent wizard and MCTB phone setup. |
| **Website Widgets / chat** | Deferred / partial embed routes | **Gap vs Rosie** |
| **Live takeover** | Not on PSTN receptionist | **Gap** (Rosie chat-specific) |
| **Account / team** | Workspace users in settings | **Standard** |

### MCTB voice-agent wizard steps (Rosie-adjacent)

From `src/lib/mctb/voice-agent/wizard-steps.ts`:

| Step ID | MCTB label |
|---------|------------|
| goals | Purpose |
| phone | Phone |
| information | Business Knowledge |
| appointments | Booking |
| call-handling | Call Handling |
| voice | Voice |
| test | Test |
| activate | Activate |

Underlying wizard: `src/components/solutions/appointment-receptionist/wizard.tsx` (`presentation="mctb"`).

---

## 6. What Transovo does better than copying Smith/Rosie

1. **One ingress, explicit ownership** — MCTB vs AI Receptionist on the **same** forward path (Call Handling ownership switch + `/mctb/voice-agent`). Smith does not model missed-call text-back vs answer-the-call as separate products on one number.
2. **One conversational agent / capabilities not agents** — Voice V2/V3 contract: one session, booking/FAQ/intake/transfer as capabilities (see `docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md`).
3. **Shared Company Brain** — Approved business facts can feed MCTB Lead Recovery FAQ and receptionist setup **without** coupling MCTB to Voice V3 RAG (#484).
4. **Transfer waterfall** — Voice V3 transfer policy (`src/lib/voice-v3/config/agent-config.ts`).
5. **Human + hybrid later** — One compiled operating profile + staffing mode (AI / Human / Hybrid) without a second dashboard; Smith is human-only execution, Rosie is AI-only UX.

---

## 7. Gaps for human receptionist and hybrid (future)

| **Need** | **Smith** | **Rosie** | **Transovo gap** |
|----------|-----------|-----------|------------------|
| **Staffing mode** | Implicitly human | Implicitly AI | **No customer IA** for AI / Human / Hybrid. |
| **Instructions as one object** | Central | Agent Settings cards | **Scattered** edit surfaces; compile target exists, presentation does not. |
| **Unified Conversations** | Call log | Inbox | **Voice calls ≠ SMS threads** in one list. |
| **Call Decisions / execution timeline** | Strong | Lighter | V3 forensics exist; call detail UI does not expose Smith-style decision path. |
| **Human handoff queue** | They are the human | Live chat takeover | **No human queue** for phone comparable to Smith ops. |
| **Follow-up comms** | In Call Handling | In conversation | MCTB recovery/SMS separate from voice post-call notifications—not one panel. |
| **Direct Transfer / VIP** | Simple list | Transfer settings | Powerful but buried in transfer destinations / Smart Routing. |
| **Rosie Publish** | N/A | Draft → Publish | Activate/publish in wizard; **no global Publish** across post-go-live sections. |

---

## 8. Recommended architecture (not a build spec)

**Do not build “Smith.ai.”** Build **one Business Operating Profile** with two presentation layers:

```
Business Operating Profile (canonical store)
├── Business knowledge (Company Brain — approved facts)
├── Call instructions / scenarios (intake, message-taking, qualification)
├── Workflow + tools (book, link, transfer, SMS)
├── Hours + escalation + spam/block
└── Staffing mode: AI | Human | Hybrid  ← future

Execution layer
├── AI → Voice V3 runtime (existing)
├── Human → queue + brief + scripts (new product layer)
└── Hybrid → same profile + escalation rules (existing transfer/message tools)
```

**Nav compression (Rosie-inspired) without losing Smith depth:**

| **Proposed customer nav (receptionist product)** | **Maps from today** |
|--------------------------------------------------|---------------------|
| **Home / Quick start** | Wizard progress + readiness (`/mctb/voice-agent` or `/voice/overview`) |
| **Conversations** | Merge voice calls + relevant SMS (filters); MCTB as `source=mctb` |
| **Receptionist setup** (Rosie-like cards + Publish) | Fold wizard steps + capabilities + knowledge |
| **Call handling & routing** | Canonical switch + transfer/blocked/hours (Smith Call Handling) |
| **Integrations** | `/integrations` |
| **Account** | Settings |

Keep **MCTB** as its **own product** (missed call → text → conversation). Link **Call handling** between products; do not duplicate Smith’s entire Call Handling page inside MCTB.

---

## 9. Smith function ↔ Transovo equivalent (quick lookup)

| Smith function | Transovo equivalent |
|----------------|---------------------|
| Call History | Call Activity / `/voice/calls` (+ MCTB missed calls for recovery) |
| Call Intelligence | `/voice/overview`, `/voice/analytics` (partial) |
| Call Details | `/voice/calls/[id]` |
| Call Decisions | Workflow/execution timeline (runtime yes, UI gap) |
| Recording / Transcript / Summary | Call detail + voice runtime |
| Actions Taken | Tool execution / `buildActionItems` |
| Call Handling | Phone / routing / canonical ownership switch |
| Smith Number | Numbers + ingress assignment |
| Transfer Lines | Transfer destinations / V3 transfer policy |
| Direct Transfers | Smart Routing / VIP-style destinations |
| Blocked Numbers | V3 blocklist |
| Voicemail | MCTB voicemail + voice voicemail surfaces |
| Follow-Up | MCTB/SMS recovery + notifications (split) |
| Availability | Business hours / after-hours in wizard + routing |
| Instructions | Agent config + capabilities + workflows (distributed UI) |
| Integrations | `/integrations` |
| Business Info | Company Brain / business profile |
| Workspace Users | Team settings |
| Billing / Plan | Billing settings |

---

## 10. Rosie Agent Settings ↔ Transovo (quick lookup)

| Rosie card | Transovo today |
|------------|----------------|
| Business Information | Company Brain + wizard Information |
| Agent Profile | Wizard Voice + agent About |
| Greeting | Wizard / connection greeting modes |
| FAQs | Brain facts + Voice KB |
| Take a Message | Intake / callback fields / message-taking capability |
| Spam Filters | V3 spam protection |
| Appointments | Wizard appointments step + calendar providers |
| Text a Link | SMS/link executors |
| Transfer Calls | V3 transfer + waterfall |
| Custom Training | Knowledge uploads / crawl |
| Launch Instructions | Phone step + activate + forwarding |
| Website Widgets | Future / embed |

---

## 11. Relationship to MCTB (#484)

PR #484 closed **MCTB AI Replies FAQ** on **Company Brain** (not Voice V3 RAG). That improves the **missed-call SMS** loop; it does **not** restructure receptionist IA.

| Concept | MCTB | Voice receptionist |
|---------|------|-------------------|
| Primary job | Missed call → consent/eligibility → text → conversation | Answer/route/book/transfer on live or forwarded calls |
| FAQ / business answers | Lead Recovery `ANSWER_APPROVED_INFORMATION` + approved brain | Voice runtime FAQ/knowledge tools + brain in wizard |
| Call handling ownership | Canonical switch vs AI on ingress | Same switch on `/mctb/voice-agent` |
| Conversations | SMS inbox (`/mctb/conversations`) | Voice call list (`/voice/calls`) |

---

## 12. Suggested follow-up (optional doc/task)

When ready for implementation planning (separate from PLATFORM/CUSTOMER sender mode):

1. Route inventory: every `/voice/*` and `/mctb/voice-agent` path — customer-visible vs legacy/admin.  
2. Rosie 12-card matrix → exact component/route or “missing.”  
3. Smith call detail sections → `/voice/calls/[id]` + API fields.  
4. IA proposal for **Receptionist setup** hub without changing Voice V3 runtime or frozen MCTB TeXML.

---

## 13. Governing principles (do not copy competitors blindly)

- Smith = **what functions** a receptionist product must expose.  
- Rosie = **how little nav** can carry those functions if grouped as “brief the receptionist.”  
- Transovo = **one operating profile**, deterministic workflow/tools, **AI + human + hybrid** as execution modes—not three dashboards.  
- MCTB and AI Receptionist remain **separate products** with **shared** business knowledge and **one** call-handling ownership model on ingress.

---

*Generated for product/strategy review. Update when receptionist IA or human/hybrid staffing ships.*
