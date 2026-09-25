# Voice V3 — UI Weight / Feature Density / Surface Architecture Audit

**Date:** 2026-09-25  
**Method:** Static source inspection only (no browser, PSTN, certification, or IA changes).  
**Scope:** Voice V3 launch-scope capabilities behind `/mctb/voice-agent`, `/voice/*`, shared integrations, and canonical wizard persistence (`AppointmentReceptionistWizardState` + compiler/runtime consumers).

**Authority:** Actual editors, control paths (`wizard-control-inventory.ts`), APIs, Prisma-backed result data, and customer-facing pages — not feature names alone.

---

## Executive summary

Voice V3 packs **Rosie-scale configuration breadth** (8 wizard steps, ~150+ distinct wizard control paths) with **Smith-scale operational surfaces** (Call Handling ~340 lines + reused editors totaling ~1.7k lines; Calls list/detail; Knowledge KB + gaps). Primary nav (7 items) is **mostly justified by density**, but **AI Agent is overloaded** as the only onboarding home for identity, knowledge seeding, booking, and a partial call-handling slice. **Call Handling** correctly mirrors the heavy transfer/on-call/spam cluster. **Knowledge** is split: wizard `information` step (~892 lines) vs operational `/voice/knowledge` (RAG KB CRUD + gaps). **Calls / Call Detail** under-surface structured outcomes (emergency, spam, intake depth, tool failures, execution trace) relative to API payload. **Integrations** are fragmented (wizard calendar OAuth, `/integrations/calendars`, MCTB phone ingress on Call Handling) — enough substance for a **consolidated hub**, not a marketplace. **Inbound routing** (`/voice/inbound-routing`) is a separate rule engine, not in primary nav — appropriate but easy to confuse with Call Handling ingress.

---

## 1. Source map (inspection anchors)

| Area | Primary sources |
|------|-----------------|
| Wizard steps & ownership | `WIZARD_STEPS`, `merge-wizard-state-on-save.ts`, `steps/*.tsx` |
| Control inventory | `src/lib/voice-v3/config/wizard-control-inventory.ts` |
| MCTB presentation | `mctb-voice-agent-page.tsx`, `wizard.tsx` (`presentation="mctb"`) |
| Call Handling ops | `call-handling-operational-page.tsx` + shared editors |
| Calls | `voice/calls/page.tsx`, `voice/calls/[id]/page.tsx`, `/api/voice/calls*` |
| Knowledge | `voice/knowledge/page.tsx`, `knowledge-gaps-panel.tsx`, wizard `information-step.tsx` |
| Analytics | `lib/voice/analytics.ts`, `voice-analytics-dashboard.tsx` |
| Needs Attention | `needs-attention-view.tsx`, `needs-attention-types.ts`, `/api/voice/needs-attention` |
| Nav | `lib/products/mctb-nav.ts` |

---

## 2. Master feature inventory (capability table)

**Legend — UI weight:** 1=small card/section, 2=medium section/editor, 3=heavy dedicated surface, 4=product area (multi-workflow nav).  
**Frequency:** SF=set-and-forget, OC=occasional, RC=recurring, DO=daily/operational.  
**Role:** OB=onboarding, CFG=configuration, OPS=operational management, RES=result/history, AN=analytics, AQ=action queue, INT=integration, X=cross-cutting.

| Capability | Current surface(s) | Controls / workflows | Result data | Wt | Freq | Primary UI role | Too buried? | Over-surfaced? | Natural home candidate | Notes |
|------------|-------------------|----------------------|-------------|-----|------|-----------------|-------------|----------------|------------------------|-------|
| Solution name & preset | Wizard Goals | 2–4 fields, capability toggles (8 caps) | — | 2 | SF | OB | — | — | AI Agent → Purpose | MCTB after-hours preset hides booking step when caps exclude book/reschedule/cancel |
| Answer-when / routing intent | Wizard Goals | `answerWhen` enum + ring options | — | 2 | SF | OB, CFG | Partially | — | AI Agent or Call Handling summary | Overlaps mentally with ingress / inbound routing (different backend) |
| Capabilities (8 flags) | Goals + Call Handling save | Toggles: Q&A, book, reschedule, cancel, messages, qualify, transfer, SMS | Runtime tool gating | 2 | OC | OB, CFG | — | — | AI Agent Purpose | Call-handling step can patch `capabilities` on save |
| Business line / number source | Wizard Phone; Call Handling ingress panel | numberSource, phone IDs, E.164, ring behavior, connection greeting modes | Call records (to/from) | 3 | OC | OB, INT | — | — | Phone: wizard + Call Handling ingress | Ingress uses `/api/call-handling` — not transfer policy |
| Outbound SMS sender (booking link / recovery) | Wizard Phone; Appointments SEND_LINK | outbound SMS mode, sender number | SMS threads | 2 | OC | OB, CFG | Yes (recovery in wizard call-handling only) | — | AI Agent Phone + Booking | Sender readiness cross-cuts Compliance |
| Connection / carrier greeting | Wizard Phone | greeting mode, text, audio URL | — | 1–2 | SF | OB | — | — | AI Agent Phone | Distinct from Amy opening greeting |
| Call recording enable | Wizard Phone; Call Handling | `callRecording` | Recordings on call detail | 1 | SF | CFG | — | — | Call Handling + wizard Phone | Duplicated field ownership on call-handling save |
| Website URL scan / import | Wizard Information (~892 LOC) | crawl, scan, knowledge items from site | KB items, gaps | 3 | OC | OB, CFG | Wizard-only for seeding | — | Knowledge + wizard brief | Operational KB lives on `/voice/knowledge` |
| Guided business profile / knowledge items | Wizard Information | knowledgeItems[], statuses, edit modal | Approved facts in runtime | 3 | OC | OB, CFG | Split from `/voice/knowledge` | — | Knowledge primary; wizard seed | Risk of two knowledge models (items vs KB sources) |
| Link existing KB | Wizard Information | linkedKnowledgeBaseId, enable flag | Retrieval | 2 | SF | CFG, INT | — | — | Knowledge | |
| Business name, timezone | Information + compiler | scalars | — | 1 | SF | OB | — | — | AI Agent Business | |
| Agent name, role, tone, style | Information | agentName, role, tone, speakingStyle, language | — | 2 | SF | OB | — | — | AI Agent Identity | Rosie “Agent Profile” analog |
| Opening greeting & speaks-first | Information | openingGreeting, speaksFirst | — | 1 | SF | OB | — | — | AI Agent Greeting | |
| Conversation behaviors (5) | Information | keepBrief, oneQuestion, confirm, no invent price/availability | — | 2 | SF | OB | — | — | AI Agent Behavior | |
| Guardrails | Information | guardrails text | — | 1 | SF | OB | — | — | AI Agent | |
| Long-term memory / CRM flags | Information | longTermMemory, crmEnabled | — | 1 | SF | CFG | — | — | AI Agent advanced | |
| Voice selection & delivery | Wizard Voice (~478 LOC) | voiceId, pace, accent, backchannel, interruption | — | 2 | SF | OB | — | — | AI Agent Voice | |
| Calendar provider connect | Appointments step | OAuth via `/api/integrations/calendars` | Booked appts on calls | 3 | OC | OB, INT | Fragmented vs `/integrations` | — | Integrations hub + wizard shortcut | MS + Google paths; Calendly in code but out of launch scope |
| Booking strategy | Appointments | NONE, REQUEST_ONLY, SEND_LINK, MICROSOFT_365 | outcome, tools | 3 | OC | OB, CFG | — | — | AI Agent Booking section | FIND/BOOK via MS/Google runtime |
| Appointment types (list entity) | Appointments | per-type duration, calendar, hours, fields, permission | — | 3 | OC | CFG | Wizard-heavy | — | AI Agent Booking editor | ~980 LOC step |
| Booking behavior (6 toggles) | Appointments; Call Handling subset | ask preferred day, offer 3, confirm, SMS after book, etc. | — | 2 | OC | CFG | Partial duplicate on call-handling step | — | Booking section | |
| Qualification rules + zip codes | Appointments | rules[], match mode, fallbacks | leadScore, outcomes | 3 | RC | CFG | Wizard only | — | AI Agent or Ops “Intake rules” | Operational tuning possible |
| Collect fields / intake | Appointments | collectFields[], required, qualification flags | structuredMessage, insights | 3 | RC | CFG, RES | Wizard; results on call detail | — | AI Agent Intake + Call detail | Intake objective also in runtime/lib |
| SEND_LINK URL + SMS consent | Appointments | URL, label, sender | SMS + outcome | 2 | OC | OB, CFG | — | — | AI Agent Booking | |
| Transfer enable & destinations | EmergencyTransferEditor; Call Handling | destinations[], plans, warm/direct, timeouts | VoiceTransfer rows | 3 | RC | CFG, OPS | Was wizard-only pre Pass 2 | — | Call Handling | ~367 LOC editor |
| Waterfall / ordered steps | Same | transferPlanSteps[], default plan | transfer history | 3 | RC | OPS | — | — | Call Handling | Preview on ops page |
| Fallback on failed transfer | Same | transferFallback enum | failed transfer NA items | 2 | OC | CFG | — | — | Call Handling | |
| Warm transfer, voicemail detect | Same | booleans | transfer outcomes | 2 | SF | CFG | — | — | Call Handling | |
| Business schedule + holidays | operating-maturity-editor (~570 LOC) | weekly ranges, holidays, TZ | after-hours behavior | 3 | RC | CFG, OPS | — | — | Call Handling | |
| After-hours behavior matrix | Same | whenClosed.* toggles (6+) | call outcomes | 3 | RC | CFG | — | — | Call Handling | |
| On-call schedule entries | Same | entries with destination, priority | on-call routing | 3 | RC | OPS | — | — | Call Handling | |
| Urgency / emergency rules | urgency-rules-editor | rules → transfer plan / fallback | emergency outcomes | 3 | RC | CFG, OPS | — | — | Call Handling | |
| Callback collection policy | call-handling step | enable, ANI, preferred time, required fields | CallbackRequest | 2 | OC | CFG | — | — | Call Handling + wizard | |
| After-hours notifications | after-hours-notifications-editor | events, recipients | notifications sent | 2 | RC | CFG | — | — | Call Handling | |
| Spam Likely / solicitor policies | spam-unwanted-calls-editor | spamLikelyPolicy, solicitorPolicy, sales solicitation | spam outcomes | 2 | RC | CFG, OPS | — | — | Call Handling | |
| AI Call Recovery (SMS) | Wizard call-handling step | consent mode, sender, delay, triggers | MCTB threads | 3 | OC | CFG, INT | Yes (voice nav doesn’t surface) | — | MCTB setup or Call Handling card | Cross-product |
| Messages & callbacks (capability UI) | call-handling step | toggles copy | messages, callbacks | 2 | OC | CFG | — | — | AI Agent + Call Handling | |
| Test scenarios & browser test | Wizard Test | scenario select, live test API | test calls | 2 | OC | OB | — | — | AI Agent Test | |
| Activate / publish | Wizard Activate | activation mode, schedule | agent status | 2 | SF | OB | — | — | AI Agent Activate | |
| Call list & filters | `/voice/calls` | 7 filters, search, metrics strip | VoiceCall list | 2 | DO | RES | — | — | Calls | Date/export UI stubbed |
| Call detail narrative | `/voice/calls/[id]` | overview + transcript tabs | full API payload | 3 | DO | RES | — | — | Call detail | See §13 |
| Knowledge base CRUD | `/voice/knowledge` | create KB, text/url/file sources, search | chunks | 3 | RC | CFG, OPS | — | — | Knowledge | Wizard information overlaps |
| Knowledge gaps | Knowledge page + call detail | open/resolve/dismiss, link to KB | VoiceKnowledgeGap | 2 | RC | AQ, CFG | — | — | Knowledge + NA link | |
| Transfer recent outcomes | Call Handling table | read API | VoiceTransfer | 2 | DO | RES | — | — | Call Handling or Calls | |
| Analytics KPIs | `/voice/analytics` | 30/7/90d | aggregated | 2 | DO | AN | — | — | Analytics | Many backend metrics unused in UI |
| Needs attention queue | `/voice/needs-attention` | 7 kinds, assign, callback bridge | mixed platform | 2–3 | DO | AQ, X | — | — | Needs Attention | Voice + MCTB + SR mixed |
| Overview dashboard | `/voice/overview` | KPIs, recent calls, quick links | snapshot | 2 | DO | X | — | Thin duplicate of analytics | Overview | Campaign metrics still shown |
| Inbound routing rules | `/voice/inbound-routing` (not in nav) | rule CRUD, simulator | routing decisions | 3 | RC | CFG | Hidden | — | Advanced / Integrations | Separate from CFNA ingress |
| Webhooks | `/integrations/webhooks` | endpoints, events, logs | delivery | 2 | OC | INT | Not in Voice nav | — | Shared Integrations | |
| Blocked callers | API + runtime | block from call detail path | suppression | 2 | RC | OPS | Buried (API-first) | — | Call Handling or Calls | |

*(Table continues logically; every row above maps to real persisted fields in `merge-wizard-state-on-save.ts` and/or Prisma voice models.)*

---

## 3. Page density table

| Page | Sections (major) | Est. meaningful controls | Workflows | Result/history on page | Density | Customer frequency | Current fit |
|------|------------------|--------------------------|-----------|------------------------|---------|-------------------|-------------|
| `/voice/overview` | Quick links, phone-min explainer, ~10 KPI cards, recent calls, failures | ~12 metrics + 1 table | Orient only | Recent calls snippet | APPROPRIATE (borderline busy) | DO | Useful hub; overlaps Analytics + duplicates campaign noise for V1 Voice |
| `/voice/calls` | Metrics, search, filters, table | 7 filters + search + pagination | Find call | Row-level summary | APPROPRIATE | DO | Good; date/export non-functional UI |
| `/voice/calls/[id]` | Header, outcomes, callback, gaps, summary, info, transcript preview, sidebar | ~15 display regions | Review one call | High (API-rich) | HEAVY content, **thin hierarchy** | DO | Needs stronger “story above fold” |
| `/mctb/voice-agent` | 8 steps, stepper, save per step | **150+** control paths | Full onboarding | Test only | **OVERLOADED** | SF→OC | Correct as wizard; too much for one linear path |
| `/voice/call-handling` | Ingress, transfer status, behavior summary, 7 editor sections, recent transfers | **80+** | Save draft, manage ops | Recent transfers table | **HEAVY** | RC | **Appropriate** grouping for “what happens on a call” |
| `/voice/knowledge` | KB list, source CRUD, search, gaps panel | ~25+ | Add sources, resolve gaps | Gap list | APPROPRIATE | RC | Scoped well; wizard duplication |
| `/voice/analytics` | KPI strip, voiceProduct outcomes, outcome table | ~15 displayed | Change range | Aggregates only | **THIN** vs backend | OC–DO | Underuses `loadVoiceAnalytics` |
| `/voice/needs-attention` | Filters, card list, actions | assign, done, callback | Triage | Per-item preview | APPROPRIATE | DO | Cross-product; voice-specific kinds OK |
| `/voice/inbound-routing` | Rule builder, simulator | ~10 per rule | Add rule | — | APPROPRIATE for niche | OC | Not primary nav — OK |

---

## 4. Capabilities too buried

1. **Calendar / OAuth connections** — Configured in Appointments wizard and `/integrations/calendars`; no Voice-nav “Integrations” entry. **Weight 3**, **OC**. Owners reconnect calendars outside wizard rarely but need discoverability when booking breaks.
2. **AI Call Recovery (MCTB SMS)** — Full control set on wizard Call Handling step only (`aiCallRecovery*` fields). **Weight 3**, **OC**. Voice operators won’t expect it inside “Call Handling” subsection of wizard.
3. **Qualification & collect-fields tuning** — **980-line** Appointments step only. **Weight 3**, **RC** for service businesses. No operational mirror except re-entering wizard Booking step.
4. **Blocked callers** — API `blocked-callers`, call-level block action; no list management in Call Handling or Calls. **Weight 2**, **RC**.
5. **Structured execution trace / tool failures** — API returns `toolExecutions`, `executionTrace`; call detail uses tools only inside `buildActionItems`, not prominent for booking/transfer failures. **Weight 2**, **DO**.
6. **Emergency / spam outcomes** — In analytics aggregates and outcome strings; **not** in call list badges or detail header. **Weight 2**, **DO**.
7. **Inbound routing rule engine** — `/voice/inbound-routing` exists but not linked from Call Handling ingress banner context. **Weight 3**, **OC**.

**Placement recommendation (hypothesis only):** Items 1 → consolidated Integrations shortcut; 2 → MCTB product link or Call Handling card; 3 → “Booking & intake” section (wizard + optional ops editor); 4–6 → Calls/Call Detail prominence; 7 → advanced link from ingress panel.

---

## 5. Capabilities over-surfaced

1. **Overview “Running campaigns” / outbound campaign KPIs** — Leftover mass-voice chrome on a receptionist overview. **Weight 1** for V1 Voice; **over-surfaced** metric.
2. **Duplicate call-handling editors** — Wizard `call-handling` step (~365 LOC) **and** `/voice/call-handling` share editors. **Good duplication** (onboarding vs ops) but wizard step still large for first-time users.
3. **Knowledge dual entry** — Website scan in wizard + full KB UI. **Good duplication** if clearly “seed vs operate”; currently **confusing ownership**.
4. **VoiceSubNav on some pages** — Secondary nav pattern; not wrong but adds chrome on Knowledge/Analytics.

**Too thin for dedicated page (keep consolidated):**

1. **Agent voice & pace** — Wizard Voice step only; **Wt 2**, **SF** — no `/voice/voice-settings` warranted.
2. **Connection greeting (carrier)** — Phone step; **Wt 1–2**.
3. **Goals / solution naming** — Purpose card only.
4. **Test & Activate** — Remain wizard terminal steps, not nav items.
5. **After-hours analytics redirect page** — Redirect only; not a destination.

---

## 6. Duplication assessment

| Duplication | Verdict | Notes |
|-------------|---------|-------|
| Wizard Call Handling ↔ `/voice/call-handling` | **GOOD** | Same `appointment-receptionist` API, `wizardStepId: call-handling` save |
| Wizard Information knowledge items ↔ `/voice/knowledge` KB | **RISKY** | Different UX models; same runtime retrieval if linked KB — document canonical path |
| Business hours in wizard Information (timezone) vs operating maturity | **GOOD** | Schedule lives in operatingMaturity; timezone in information |
| Phone ingress: wizard Phone vs Call Handling `VoiceIngressSetupPanel` | **GOOD** | Ingress product ownership vs Amy behavior |
| `/voice/inbound-routing` vs Call Handling | **BAD confusion risk** | Different APIs (`/api/voice/routing` vs wizard state); not duplicate editors |
| MCTB Integrations nav vs Voice calendar OAuth | **FRAGMENTED** | Same user task, multiple URLs |

---

## 7. Structured result data under-surfaced

**Call list**

- Available: `outcome`, `appointmentBooked`, `transferred`, `voicemailDetected`, `leadScore`, `insights[0].summary`, recording flags.
- **Not shown:** emergency/spam flags in outcome text only (no icon), callback pending, knowledge-gap indicator, failed transfer hint, REQUEST_ONLY vs booked distinction.
- **Highest value adds (hypothesis):** compact outcome chips (booked / callback / transfer failed / emergency / spam), optional “needs attention” dot.

**Call detail**

- API: events, toolExecutions, transfers, callbackRequest, knowledgeGaps, structuredMessage, insights (intent, sentiment, customFields), executionTrace, recordings.
- **PROMINENT:** caller header, outcome badges (limited set), callback card, gaps section, AI summary, action items list (non-skipped).
- **PRESENT BUT BURIED:** intent/sentiment (not in header), full transcript before “why”, activity feed in sidebar not primary.
- **NOT SURFACED:** executionTrace, per-tool errors beyond transfer/book/message, emergency classification, spam/solicitor outcome, appointment REQUEST_ONLY vs booked clarity in header, link to Needs Attention item, block caller affordance (if any in UI).

**Rosie-style screen test (call detail)**

| Question | First screen today? |
|----------|---------------------|
| Who called? | **Yes** (H1 + sidebar) |
| Why did they call? | **Partial** (reason in info fields / summary, not headline) |
| What happened? | **Partial** (outcomes list; competes with recording) |
| Amy complete requested action? | **Partial** (action items; booking edge cases weak) |
| Anything required from me? | **Weak** (no NA link; callback card only) |
| Appointment booked? | **Partial** (badge + action item) |
| Callback requested? | **Yes** if CallbackRequest exists |
| Transferred? | **Partial** (action item; not header) |
| Urgent/emergency? | **No** dedicated |
| Knowledge gap? | **Yes** if gaps linked to call |

**Overview / Analytics / Needs Attention**

- Overview: no knowledge-gap count, no failed-transfer count (Analytics has them).
- Analytics: `byDay`, sentiment, latency, cost, byAgent — **computed, not shown**.
- Needs Attention: `failed_transfer` supported; booking failure / knowledge issue **not** distinct kinds in `needs-attention-types.ts`.

---

## 8. AI Agent / wizard structure inventory

```
AI AGENT (/mctb/voice-agent) — AppointmentReceptionistWizard (mctb)
├── Purpose (goals) — ~405 LOC
│   ├── capabilities (8)
│   ├── answerWhen / solutionName / preset
│   Wt 2 | SF | REMAIN | ops mirror: none | move: none
├── Phone — ~542 LOC
│   ├── number source, business line, SMS sender, ring, recording, connection greeting
│   Wt 3 | SF–OC | REMAIN | ops mirror: Call Handling ingress panel | move: ingress ops already mirrored
├── Business Knowledge (information) — ~892 LOC
│   ├── website scan/import, knowledge items, KB link, identity, tone, greeting, behaviors, guardrails
│   Wt 3–4 | SF–OC | REMAIN (brief) | ops mirror: /voice/knowledge | move: heavy CRUD toward Knowledge
├── Booking (appointments) — hidden if no book caps — ~980 LOC
│   ├── calendar OAuth, strategy, types, behaviors, qualification, collect fields, SEND_LINK
│   Wt 4 | OC–RC | REMAIN as section | ops mirror: weak | move: optional ops “Booking” section (not nav)
├── Call Handling (wizard step) — ~365 LOC
│   ├── booking behavior subset, emergency transfer editor, urgency, callbacks, notifications, AI recovery, spam
│   Wt 3 | RC | SHRINK in wizard | ops mirror: /voice/call-handling (canonical ops) | move: ops-first for RC items
├── Voice — ~478 LOC
│   Wt 2 | SF | REMAIN | none | none
├── Test — ~183 LOC
│   Wt 2 | OC | REMAIN | none | none
└── Activate — ~232 LOC
    Wt 2 | SF | REMAIN | none | none
```

**MCTB step labels:** Purpose, Phone, Business Knowledge, Booking, Call Handling, Voice, Test, Activate (`wizard-steps.ts`).

**Density verdict:** **OVERLOADED** as a single linear wizard; appropriate if post-activate edits route to Call Handling + Knowledge + Integrations.

---

## 9. Call Handling structure inventory

```
CALL HANDLING (/voice/call-handling)
├── Voice ingress / product ownership (VoiceIngressSetupPanel)
│   ├── active handler, forwarding, call-handling API
│   KEEP — distinct from inbound routing rules
├── Transfer effective status + waterfall preview
│   KEEP — hierarchy anchor
├── Current behavior summary (read-only)
│   KEEP
├── Transfers (EmergencyTransferEditor)
│   ├── enable, destinations, plans, warm/direct, timeouts, fallback
│   KEEP | NEEDS STRONGER HIERARCHY (largest block)
├── Business hours & after hours (BusinessScheduleEditor + AfterHoursBehaviorEditor)
│   KEEP — shared mental model with on-call
├── On-call (OnCallScheduleEditor)
│   KEEP
├── Emergency & urgent (urgency toggle + UrgencyRulesEditor)
│   KEEP | MERGE visually with Transfers (related escalation)
├── Transfer notifications (AfterHoursNotificationsEditor)
│   KEEP | could MERGE WITH Emergency/urgent group
├── Caller protection (SpamUnwantedCallsEditor)
│   KEEP
├── Call recording (RecordingConfigCard)
│   KEEP | BETTER ELSEWHERE: optional merge with Phone/ingress “compliance” group
└── Recent transfers (table + API)
    KEEP — ops result history
```

**Density verdict:** **HEAVY** but **appropriate** for one page; internal **tabs or accordion** likely needed before adding more sections.

---

## 10. Knowledge, Analytics, Needs Attention, Overview, Integrations (special audits)

**Knowledge (`/voice/knowledge`)** — KB list, per-KB sources (text, URL crawl, file upload), reindex/delete, search test, gaps panel with resolve-to-KB. Wizard still owns `knowledgeItems[]` and website scan. **Verdict:** Page **appropriately scoped**; wizard should stay **brief** (URL + link KB) not full duplicate.

**Analytics** — Backend returns: costs, AI/telephony minutes, sentiment, byAgent, byCampaign, byDay trends, tool latency, response latency, diagnostics, humanAnswerRate, voiceProduct block. UI shows: totals, answer rate, avg duration, voiceProduct outcome counts, raw outcome table. **Gap:** no charts for `byDay`, no drill-down links to Calls filters, no cost/latency/sentiment.

**Needs Attention** — Kinds: `callback_request`, `voicemail`, `mctb_reply`, `missed_call`, `form_submission`, `repeat_caller`, `failed_transfer`. Voice-relevant: callback, failed transfer, voicemail; MCTB/SR mixed in copy. Actions: mark done, claim, assign (limited kinds), callback bridge. **Could appear but doesn’t:** booking failure queue, knowledge gap tickets, emergency follow-up as distinct kind.

**Overview** — Mixes receptionist KPIs with campaigns/monthly cost. Quick links to Calls, Call Handling, Knowledge, NA — **good**. **Role:** orient + route; should not grow into config.

**Integrations (Voice-relevant)** — Microsoft/Google calendar OAuth (`/integrations/calendars`, wizard), webhooks (`/integrations/webhooks`), CRM native webhooks (HubSpot/Salesforce/Shopify), Calendly (legacy), Telnyx/provider implicit. **Fragmentation:** high. **Marketplace:** not justified. **Consolidated Voice-facing Integrations page:** **YES** (connection status + deep links), shared with org Integrations.

---

## 11. Navigation weight audit

| Nav item | Workflows | Controls (order of magnitude) | Result/history | Freq | Top-level justified? |
|----------|-----------|-------------------------------|----------------|------|----------------------|
| Overview | 1 | ~12 | Light | DO | Yes — hub |
| Calls | 2 | ~10 + table | Heavy | DO | Yes |
| AI Agent | 8+ steps | 150+ | Test only | SF→OC | Yes — but should shrink post-activate |
| Knowledge | 3 | ~25+ | Gaps | RC | Yes — Wt 3 |
| Call Handling | 8 sections | 80+ | Recent transfers | RC | Yes — Wt 3 |
| Analytics | 1 | ~15 shown | Aggregates | OC–DO | Yes — if enriched or merged partially with Overview |
| Needs Attention | 1 | Triage | Queue | DO | Yes — cross-product |

**Not in nav but Wt≥3:** `/voice/inbound-routing` (advanced), `/integrations/*` (calendar/webhooks), MCTB setup routes (recovery, etc.).

**Recommended primary nav count (hypothesis):** **7** unchanged, or **6** if Overview absorbs lightweight Analytics and Integrations becomes shared footer — only if Integrations hub ships.

---

## 12. Architecture hypothesis (not implementation)

**Primary navigation:** Keep **Overview, Calls, AI Agent, Knowledge, Call Handling, Analytics, Needs Attention**. Add **Integrations** only as **Shared** nav (already exists for MCTB) with Voice-relevant grouping — not an 8th Voice-only top item unless product marketing requires it.

**AI Agent internal:** Rosie-style **plain-language sections** — Purpose, Phone, Business brief, Booking (conditional), Voice, Test, Activate — **move recurring ops** (transfers, on-call, spam, notifications) to Call Handling with wizard **summary + deep link** only.

**Call Handling internal:** Tabs: **Ingress & recording** | **Transfers & escalation** | **Hours & on-call** | **Caller protection** | **Activity** (recent transfers).

**Knowledge internal:** **Sources & bases** | **Gaps** (already); wizard imports become “Add from website” CTA → Knowledge.

**Calls / Call detail:** List adds high-value chips; detail puts **Outcome strip** (booked, callback, transfer, emergency, spam, gap) under H1 before recording; sidebar keeps metadata.

**Integrations:** Single **status board** (Calendar MS/Google, SMS sender, webhooks) with links — no marketplace.

**Overview:** KPI strip + **3 actionable queues** (Needs attention count, open gaps, failed transfers) — trim campaign metrics for V1 Voice.

**Needs Attention:** Keep cross-product inbox; improve **voice kind labels** and deep links to `/voice/calls/[id]`.

**Analytics:** Surface `byDay` trend + drill-down URLs; move per-call forensics to Calls.

---

## 13. Final verdict (§36)

```
VOICE FEATURE INVENTORY COMPLETE: YES
ALL CUSTOMER-FACING CAPABILITIES WEIGHTED: YES

AI AGENT DENSITY: OVERLOADED
CALL HANDLING DENSITY: HEAVY (appropriate grouping)
KNOWLEDGE DENSITY: APPROPRIATE (with wizard overlap risk)
CALLS / CALL DETAIL DENSITY: HEAVY data / APPROPRIATE pages (hierarchy gap on detail)
ANALYTICS DENSITY: THIN (vs backend)
NEEDS ATTENTION DENSITY: APPROPRIATE
OVERVIEW DENSITY: APPROPRIATE (trim non-V1 metrics)

CAPABILITIES TOO BURIED:
- Calendar OAuth / integrations discovery
- AI Call Recovery controls (wizard-only)
- Qualification & collect-fields (wizard-only)
- Blocked caller management
- Tool failure / execution trace on call detail
- Emergency & spam outcomes on list/detail
- Inbound routing vs ingress distinction

CAPABILITIES OVER-SURFACED:
- Campaign/outbound KPIs on Voice overview
- Full call-handling editor duplicated in wizard (acceptable but large)

STRUCTURED RESULT DATA UNDER-SURFACED:
- Call list: emergency, spam, callback, transfer-failed, gap indicators
- Call detail: intent/sentiment, emergency, spam, executionTrace, tool errors, NA linkage
- Overview: gap + failed-transfer counts
- Analytics: byDay, cost, latency, sentiment, byAgent
- Needs Attention: booking failure, knowledge issues (no kinds today)

DEDICATED PAGE CANDIDATES:
- Call Handling (existing — keep)
- Knowledge (existing — keep)
- Calls (existing — keep)
- Optional: Integrations hub (shared, not Voice-only)
- NOT warranted: Greeting, Voice settings, Booking-only top-level page

FEATURES THAT SHOULD REMAIN CONSOLIDATED:
- Agent voice/pace, connection greeting, goals/purpose, test/activate
- Recording toggle (small — stay with Phone/Call Handling)
- Business identity tone/greeting (AI Agent sections)

INTEGRATIONS PAGE JUSTIFIED BY CURRENT PRODUCT: YES (consolidation, not expansion)

RECOMMENDED PRIMARY NAV COUNT: 7 (or 6 + shared Integrations emphasis)

READY FOR FINAL UI ARCHITECTURE DECISION: YES
```

---

## Appendix A — Wizard control path scale

From `wizard-control-inventory.ts`: capabilities (8), collect fields, appointment types (14 fields each), knowledge items, qualification rules, urgency rules, transfer destinations & plan steps, weekly schedule (7 days), holidays, on-call entries, callback SLA, booking/conversation behavior keys, plus **50+ scalars** (phone, calendar, booking strategy, transfer modes, spam policies, AI recovery, voice IDs, activation).

**Total distinct control paths:** ~150+ (documented in inventory file).

## Appendix B — Editor line counts (complexity proxy)

| Component | Lines |
|-----------|------:|
| appointments-step.tsx | 980 |
| information-step.tsx | 892 |
| operating-maturity-editor.tsx | 570 |
| phone-step.tsx | 542 |
| voice-step.tsx | 478 |
| goals-step.tsx | 405 |
| call-handling-step.tsx | 365 |
| emergency-transfer-editor.tsx | 367 |
| call-handling-operational-page.tsx | 341 |
| knowledge/page.tsx | ~309 |

---

*End of audit. No routes, nav, or components were modified.*
