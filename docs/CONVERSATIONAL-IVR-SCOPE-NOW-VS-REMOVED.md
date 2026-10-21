# Conversational IVR — what’s on the product now vs what we removed from the nav

**As of:** October 21, 2026  
**Code basis:** `new-app` product under `/app/receptionist/*` (conversion commit `7094a5bfe`, hardening `95c94c402`)  
**Compares:** **Conversational IVR** (current customer-facing product) vs **AI Receptionist** (previous full Voice V3 receptionist UX)

**Not the same thing:** **Phone → Auto Attendant** (`/app/phone/auto-attendant`) is still the **classic DTMF / keypad menu IVR** on the Phone product. This document is about the **AI voice product** rename and scope cut, not the Auto Attendant builder.

---

## 1. Product name and positioning

| | Before (AI Receptionist) | Now (Conversational IVR) |
|---|--------------------------|---------------------------|
| Product title in app switcher | AI Receptionist | **Conversational IVR** |
| Default agent role copy | Full receptionist (“answers, books, transfers…”) | **Conversational phone menu** |
| Default `runtimeProfile` | Effectively full receptionist behavior | **`conversational_ivr`** (default for new configs) |
| Mental model in UI | One agent does booking + intake + ops | **Route, answer from knowledge, or take a message** |

The **`full_receptionist`** profile and all related backend code still exist in the repo for future/internal use; the **launch nav and defaults** target conversational IVR only.

---

## 2. Sidebar navigation (customer-visible)

### What we show **now** (5 items + Overview)

| Nav label | Route | Purpose |
|-----------|--------|---------|
| Overview | `/app/receptionist` | Status, KPIs, setup readiness, recent calls, link to Phone routing |
| Business Knowledge | `/app/receptionist/knowledge` | Profile, FAQs, sources, gaps |
| Call Routing | `/app/receptionist/call-routing` | **Semantic** transfer destinations (intent-based routes) |
| Message Taking | `/app/receptionist/message-taking` | Enable messages + conversational question prompts |
| Calls | `/app/receptionist/calls` | Call history and detail |

### What we **removed from the sidebar** (still reachable by URL in many cases)

| Former nav label | Route | Why it left the nav |
|------------------|--------|---------------------|
| Agent Settings | `/app/receptionist/agent` | Not part of the simplified “configure three things” story; voice/greeting/capabilities still edited here via Overview shortcuts |
| Knowledge *(old label)* | *(same URL, renamed)* | Renamed **Business Knowledge** only |
| Appointments | `/app/receptionist/appointments` | **Live booking / calendar** cut from conversational launch profile |
| Call Handling | `/app/receptionist/call-handling` | Coverage, legacy transfer triggers, operations, recovery, spam — **de-emphasized**; Phone assignment partly moved to Call Routing |
| Test | `/app/receptionist/test` | Removed from nav; **Test agent** button remains on Overview |
| Analytics | `/app/receptionist/analytics` | Removed from nav; route may still exist |

---

## 3. Overview page — what changed

### Metrics / emphasis **now**

- Calls handled, Transferred, Needs attention, Avg handle time  
- **Setup readiness** checklist: Business knowledge, Routing destinations, Message taking, Phone assignment  
- **How your calls are handled** → links to **Phone → Call Handling** (`/app/phone/call-handling`) for answering policy  
- Flow copy: *Incoming call → Conversational IVR → Route / Answer / Message*

### Removed or de-emphasized on Overview

| Removed / changed | Notes |
|-------------------|--------|
| **Booked** KPI stat | Booking is not a primary outcome for conversational IVR |
| Sidebar **“When Ava answers”** panel tied only to receptionist call-handling | Replaced by Phone routing summary + readiness list |
| **Readiness** panel with calendar-connected / appointment setup prominence | Calendar/booking no longer first-class in nav |
| Title/description promising “Ava answers, **books**, transfers…” | Replaced with conversational-menu description |

### Still on Overview (not in sidebar)

- **Voice & greeting** → `/app/receptionist/agent`  
- **Test agent** → `/app/receptionist/test`  
- **Review & publish** → `/app/receptionist/activate` (when draft changes exist)

---

## 4. Configure surfaces — detail: **now** vs **removed / inactive**

### A. Business Knowledge — **kept and renamed**

**Now (`/app/receptionist/knowledge`):**

- Knowledge **profile** (business overview, services, policies, etc.)  
- **FAQs**  
- **Sources** (e.g. website, uploads)  
- **Gaps** (unanswered questions from calls)  
- Publish still recompiles linked knowledge for voice runtime  
- Publish guard: **max 2 vector-backed knowledge bases** for conversational IVR (explicit error if exceeded)

**Removed from customer story:**

- Treating knowledge as optional sidecar to a **booking-first** setup wizard  
- *(No major feature removed from the knowledge manager itself.)*

---

### B. Call Routing — **new primary routing UX**

**Now (`/app/receptionist/call-routing`):**

- **Semantic routes**: name, description, **intent description** (natural language, not keywords)  
- **Transfer phone number** per route (syncs to Phone **forwarding destination**)  
- Global defaults: when caller wants a person, when no rule matches, when transfer fails  
- Example template for sales-style route  
- Phone number assignment context on this flow  

**Removed / not offered in conversational routing UI:**

- **Ring groups** as a transfer destination (was briefly wrong — first member only). **V1:** individual numbers / forwarding destinations only; publish **blocks** `destinationKind: ring_group`  
- Legacy **keyword / trigger transfer lists** as the main UX (still in draft model under `transfers` / `triggers` on call-handling page, not in nav)  
- **Transfer destination kinds** beyond external phone / forwarding destination in the conversational editor  

---

### C. Message Taking — **new dedicated page**

**Now (`/app/receptionist/message-taking`):**

- Toggle: allow callers to leave a message  
- **Questions to ask** — guidance only, not a rigid form  
- Additional instructions for the agent  
- Runtime: **`take_message`** tool when enabled  

**Changed behavior vs full receptionist:**

- No dependency on **callback request** product toggle for persisting messages (hardening)  
- Agent instructions: do **not** re-ask for info already given; not a full intake form  

**Removed from conversational runtime:**

- **`request_callback`** as a separate tool (full profile only)  
- Structured intake-driven message flows tied to **qualification**  

---

### D. Agent Settings — **off nav, still in repo**

**Still at `/app/receptionist/agent` if you open the URL or use Overview buttons:**

- Identity & voice (name, role, language, GPT-Live voices, custom voice id)  
- Greeting  
- Style (pace, backchannels, patience, interruptions)  
- **Capabilities toggles** (book, reschedule, cancel, qualify, SMS confirm, etc.)  
- Intake & qualification builders  
- Custom instructions  
- Memory & CRM  

**Effect for `runtimeProfile: conversational_ivr` (default):**

- Capability toggles for **book / reschedule / cancel / qualify / SMS** do **not** turn on live runtime tools (see §5)  
- Defaults for new agents: **book/reschedule/cancel/qualify/smsConfirm = off**; **answer, message, transfer = on**  
- Intake fields in draft may still exist but **compile to empty** for conversational IVR (`collectIntake: false`)

---

### E. Appointments — **off nav, inactive in conversational runtime**

**Still at `/app/receptionist/appointments`:**

- Calendar provider (Google, Microsoft, Calendly, none)  
- Booking strategy (live calendar, link, request-only)  
- Appointment types, durations, modalities  
- Booking link / SMS sender settings  

**Removed from conversational **live** behavior:**

- Live **find availability** / **book appointment**  
- **Reschedule** / **cancel** appointment tools  
- **Send booking link** / **submit appointment request**  
- **Scheduling preference** collection for booking pipeline  
- Booking strategy forced to **`NONE`** in voice compile for conversational profile  
- Prompt guards: agent must **not** claim appointments are booked or quote confirmed times  

---

### F. Call Handling — **off nav; partially superseded**

**Still at `/app/receptionist/call-handling`:**

- Number connection / number picker  
- **Coverage** (every call, after hours, overflow, custom schedule)  
- Legacy **transfer destinations** and **triggers**  
- Message / recovery settings (including recovery SMS consent)  
- Spam / solicitor protection  
- Connection audio, recording  
- **Operations editor** (business schedule, after-hours behavior, on-call, callback SLA)  

**What moved or changed for conversational launch:**

- **Primary transfer configuration** for customers → **Call Routing** (semantic routes)  
- Overview points to **Phone → Call Handling** for **when** Conversational IVR answers (with staff-first / after-hours on the Phone side)  
- Ring groups for **IVR transfer targets** — not supported in conversational compile  

---

### G. Test — **off nav**

**Still at `/app/receptionist/test`:**

- LiveKit browser test console (when configured)  

**Removed:** permanent **Test** item in sidebar (Overview shortcut remains).

---

### H. Analytics — **off nav**

**Still at `/app/receptionist/analytics`:**

- Receptionist analytics page content (if loaded)  

**Removed:** **Analytics** from product sidebar (Phone product still has Analytics).

---

### I. Activate / Publish — **unchanged path, not in sidebar**

**`/app/receptionist/activate`:**

- Review checklist, publish, pause/resume  
- Publish review still links to **agent**, **appointments**, and **call-handling** for deep fixes (some checks irrelevant when booking caps are off)

---

## 5. Voice runtime tools — **active now** vs **full AI Receptionist**

### Conversational IVR (`runtimeProfile: conversational_ivr`) — **allowed tools**

| Tool | When active |
|------|-------------|
| `end_call` | Always |
| `search_business_knowledge` | When “answer questions” capability on |
| `transfer_call` | When transfer capability on + valid compiled routes |
| `take_message` | When message taking enabled |

### Full AI Receptionist (`runtimeProfile: full_receptionist`) — **not on conversational launch path**

Includes, when capabilities and calendar strategy allow:

- `update_intake`  
- `set_scheduling_preference`, `find_availability`, `book_appointment`  
- `find_appointment`, `reschedule_appointment`, `cancel_appointment`  
- `send_booking_link`, `submit_appointment_request`  
- `request_callback`  
- `report_unwanted_solicitor` (when protection rules enabled)  

### Other runtime behavior **turned off** for conversational IVR

- Structured **intake objective** / enforced field collection  
- **Recovery** flows tied to full receptionist booking recovery  
- **Delegated runtime context** pushes for full booking handoff  
- **SMS send** from agent capabilities (`sendSms: false` in compile overrides)  
- **Qualify callers** capability at runtime  

**Important:** Workspaces must **republish** after the profile change; old published versions may still expose full receptionist tools until republished.

---

## 6. Default capability flags (new drafts)

| Capability | AI Receptionist (typical before) | Conversational IVR default now |
|------------|----------------------------------|------------------------------|
| Answer questions | On | **On** |
| Book appointments | Often on | **Off** |
| Reschedule / Cancel | Optional | **Off** |
| Take messages | On | **On** |
| Qualify callers | Often on | **Off** |
| Transfer | On | **On** |
| SMS booking confirm/link | Optional | **Off** |

---

## 7. Phone product (related, not removed)

These stay on **Phone**, separate from Conversational IVR nav:

| Feature | Route | Role |
|---------|--------|------|
| Call Handling / answering modes | `/app/phone/call-handling` | Staff-first, conversational IVR first, forwarding, etc. |
| Call Forwarding & ring groups | `/app/phone/forwarding` | PSTN forwarding, ring groups for **Phone** call control |
| **Auto Attendant** (classic IVR) | `/app/phone/auto-attendant` | DTMF menus, “Press 1 for…”, ring group / voicemail actions |
| Business hours, voicemail, dialer, etc. | `/app/phone/*` | Unchanged scope |

Conversational IVR **reuses** Phone forwarding destinations for transfer numbers; it does **not** replace Auto Attendant menus.

---

## 8. Quick checklist for stakeholders

**Customer configures today (intended path):**

1. Business Knowledge  
2. Call Routing (who to transfer to, in plain language)  
3. Message Taking  
4. Phone assignment / answering policy (Phone + publish)  
5. Optional: Voice & greeting, Test, Publish  

**Explicitly out of launch UX (code preserved):**

- Appointments / live booking in the AI product nav  
- Full intake & qualification as a configured product surface  
- Receptionist Analytics & Test in sidebar  
- Ring groups as conversational transfer targets  
- Full receptionist tool surface on published agents without `full_receptionist` profile + republish  

---

## 9. Source references in repo

- Nav cut: `new-app/lib/nav.ts` (compare to parent of commit `7094a5bfe`)  
- Profile & tool allowlist: `new-app/lib/receptionist/runtime-profile.ts`  
- Compile overrides: `new-app/lib/server/voice-v3/editor-to-voice-v3-config.ts`  
- Tool catalog gate: `new-app/lib/server/voice-v3/tools/voice-tool-catalog.ts`  
- Product review: `docs/CONVERSATIONAL-IVR-PR-718-HARDENING-BRIEF.md`  

---

*Copy-friendly export: same content may be mirrored under `/opt/cursor/artifacts/` on Cloud Agent runs.*
