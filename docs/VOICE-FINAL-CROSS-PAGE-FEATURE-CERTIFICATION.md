# Voice — Final Cross-Page Feature Exposure Certification

**Date:** 2026-09-25  
**Mode:** READ ONLY — no code, schema, or runtime changes  
**Auditor:** Cursor Cloud Agent  

**Evidence baseline (intended launch UI):**  
- Six-page Voice IA + Overview/Analytics implementation: `origin/cursor/voice-overview-impl-2304`  
- Navigation reconciliation: `cursor/voice-nav-reconciliation-2304` (PR #516)  
- Shared runtime/libs: `master` (Voice V3, post-call, transfers, knowledge indexing unchanged by this audit)

**Important:** On `master` alone, several canonical nav targets still redirect or stub (`/voice/receptionist` → `/voice/setup`, `/voice/analytics` → MCTB analytics). **Launch certification assumes Voice page branches are merged** before customer-facing cert. Nav reconciliation without page merge would be a deployment P0.

---

## 1. Executive verdict

The **intended** post-merge product exposes most Voice V3 after-hours capabilities through the locked six destinations plus first-run wizard, shared Integrations, and global Call Handling ownership. **Call Handling** (`CallHandlingOperationalPage`) re-hosts on-call schedule, emergency transfer/waterfall, urgency rules, spam/solicitor, recording config, and after-hours notifications against the same `appointment-receptionist` API used by the wizard. **Business Knowledge** hosts crawl, sources, structured facts, and **KnowledgeGapsPanel** with resolve/index path. **Receptionist** hosts identity, greeting, responsibilities, intake, booking modes, test/publish. **Calls** + detail surfaces outcomes, attention, transcript, recording player, deterministic actions, transfer history. **Analytics** shares outcome classifiers with Calls/Overview.

**Material exposure gaps remain** where runtime exists but **customer self-serve configuration or discovery is missing or weak**, chiefly: **outbound Voice post-call webhooks** (delivery wired; no UI to create `Webhook` rows with `voice.*` events), **Voice-branded morning/daily call digest** (only generic workspace in-app notification digest in Settings), and **recording playback E2E** (UI + APIs exist; formal PSTN ingest cert not proven). **Common reasons for calling** are not aggregated on Analytics; structured “reason” is intake/summary-derived per call, not a reliable taxonomy — treat as **intentional omission**, not regression.

**Legacy competition:** `/voice/agents/*` remains live (agent-builder shell) alongside `/voice/receptionist` — risks two Receptionist architectures after nav reconciliation.

---

## 2. Master feature certification table

Columns abbreviated in cells as: **Cls** = classification (A–J per §28), **Owner** = canonical owner route, **Disc?** = discoverable from final six-item IA without legacy-only paths.

### A. Phone / after-hours ingress

| Capability | Cls | Owner | Customer route | UI / control | Save / API | Persistence | Runtime | Result surface | Disc? | Dup? | Gap? | Evidence |
|------------|-----|-------|----------------|--------------|------------|-------------|---------|----------------|-------|------|------|----------|
| Keep existing business number (CFNA model) | A | Call Handling | `/voice/call-handling` | `VoiceIngressSetupPanel` | `POST /api/solutions/appointment-receptionist` | SolutionSetup + call-handling phone settings | Telnyx ingress / forwarding | Overview phone state, setup copy | Y | N | — | `call-handling-operational-page.tsx`, `voice-ingress-setup-panel.tsx` |
| Conditional / no-answer forwarding instructions | A | Call Handling | `/voice/call-handling` | Ingress panel + MCTB setup cross-links | same | phone settings JSON | CFNA pipeline | forwarding verification in MCTB when MCTB handler | Y | N | — | ingress panel; MCTB `/mctb/setup/phone` |
| Voice ingress number assignment | A | Numbers / Call Handling | `/voice/numbers`, Call Handling | Numbers list; ingress panel | numbers APIs | `PhoneNumber` | ingress routing | Overview | Y | N | — | `src/app/(app)/voice/numbers` |
| Global handler = AI Receptionist | A | Shell switcher | any | `CallHandlingSwitcher` | `POST /api/call-handling` | workspace phone settings | `setActiveCallHandler` | Overview operational state | Y | N | — | `call-handling-switcher.tsx` |
| Global handler = MCTB | A | Shell / MCTB | `/mctb/*` | switcher | same | same | MCTB runtime | MCTB Overview | Y | N | — | same |
| Answering ownership state display | A | Overview | `/voice/overview` | operational cards | `GET /api/voice/overview` | derived | `resolveEffectiveCallHandler` (not on overview load per spec) | Overview | Y | N | — | `overview-summary.ts` |
| Forwarding setup / readiness | A/E | Call Handling + MCTB | `/voice/call-handling`, `/mctb/setup/phone` | ingress + link | appointment-receptionist + MCTB setup | mixed | forwarding verify jobs | status rows | Y | partial | MCTB owns verify detail | cross-links in Call Handling |
| Advanced inbound routing rules | H | Advanced | `/voice/inbound-routing` | rule builder (legacy Smart Routing style) | `/api/voice/routing` | routing rules | legacy/alternate routing | — | contextual only | Y vs Call Handling | not primary IA; still live |

### B. Receptionist conversation

| Capability | Cls | Owner | Customer route | UI / control | Save / API | Persistence | Runtime | Result | Disc? | Dup? | Gap? | Evidence |
|------------|-----|-------|----------------|--------------|------------|-------------|---------|--------|-------|------|------|----------|
| Receptionist identity / name | A | Receptionist | `/voice/receptionist` | Identity section | appointment-receptionist + publish | agent config / wizard state | compiled Voice V3 config | Calls detail agent name | Y | wizard D | — | `voice-receptionist-editor.tsx` |
| Voice selection | A | Receptionist | `/voice/receptionist` | Voice step | same | same | TTS/LiveKit voice | — | Y | wizard | — | `VoiceStep` |
| Business greeting | A | Receptionist | `/voice/receptionist` | Greeting section | same | same | runtime greeting | — | Y | wizard | — | editor sections |
| Conversational behavior / goals | A/B | Receptionist | `/voice/receptionist` | Goals / responsibilities | same | prompt + capabilities | GPT-Live / tools | transcript | Y | wizard | model-native partial | `GoalsStep` |
| One-question-at-a-time | B | — | — | not separate toggle | — | prompt/compiler | runtime | — | — | — | model-native |
| Responsibilities / capabilities | A | Receptionist | `/voice/receptionist` | Responsibilities | same | capabilities flags | tool gating | action items on detail | Y | wizard | — | editor |
| Custom caller intake / required fields | A | Receptionist | `/voice/receptionist` | Caller Information editors | same | intake schema | `update_intake` | captured fields on detail | Y | wizard | — | `ReceptionistCollectFieldsEditor` |
| Volunteered information capture | B/C | — | — | — | — | intake state | runtime | detail captured fields | — | — | — | intake objective runtime |
| Lead / customer collection | C | Calls | `/voice/calls/[id]` | — | — | call metadata | tools | detail | Y | — | — | `buildCapturedFields` |
| Message-taking behavior | A/B | Receptionist | goals + runtime | configure goals | compile | `take_message` tool | post-call outcome | Y | — | — | tool catalog |
| Callback behavior | A | Receptionist + Call Handling | `/voice/receptionist`, callbacks in CH | callback fields editors | same | callback policy | `request_callback` | Calls outcome | Y | partial | — | editors + runtime |
| Appointment behavior modes | A | Receptionist | `/voice/receptionist` | Appointment Handling | same | booking strategy | book tools | detail + analytics | Y | wizard | — | `ReceptionistBookingHandlingSection` |
| Booking-link behavior | A | Receptionist | same | booking section | same | config | `send_booking_link` | outcome badge | Y | — | — | runtime + UI |
| Language (EN/ES) | B | — | — | no dedicated selector | — | model | multilingual model | — | — | — | §23 |
| Test Receptionist | A | Receptionist | `/voice/receptionist` | Test step | test session APIs | — | LiveKit test | — | Y | wizard | — | `TestStep` |
| Draft / save | A | Receptionist | `/voice/receptionist` | Save draft | persist groups API | agent DRAFT | — | status pill | Y | wizard | — | `persistReceptionistDraftGroups` |
| Publish / activate | A | Receptionist | `/voice/receptionist` | Activate | publish APIs | ACTIVE agent | LiveKit dispatch | Overview status | Y | wizard | — | `persistReceptionistActivate` |

### C. Business Knowledge

| Capability | Cls | Owner | Customer route | UI | API | Persistence | Runtime | Result | Disc? | Dup? | Gap? | Evidence |
|------------|-----|-------|----------------|-----|-----|-------------|---------|--------|-------|------|------|----------|
| Business name / core info | A | Business Knowledge | `/voice/knowledge` | profile fields | appointment-receptionist / knowledge APIs | knowledge items | RAG + prompt | answers on calls | Y | CH summary | deliberate link | `business-knowledge-editor.tsx` |
| Business hours | A | Business Knowledge | `/voice/knowledge` | `BusinessScheduleEditor` | same | operatingMaturity + knowledge item | hours gating | Call Handling summary link | Y | CH read-only summary | not competing editor | schedule sync helpers |
| Timezone | A | Business Knowledge | same | schedule editor | same | maturity TZ | analytics TZ, scheduling | analytics buckets | Y | — | — | `localDateKeyInTimezone` |
| Overnight schedule | A | Business Knowledge / CH | `/voice/knowledge`, CH summary | schedule + after-hours behavior | same | maturity | operating state | — | Y | — | — | operating maturity |
| Services / areas / policies / FAQs | A | Business Knowledge | `/voice/knowledge` | knowledge tables | knowledge CRUD | items + KB sources | FileSearch RAG | — | Y | — | — | editor |
| Custom knowledge | A | same | same | custom entries | same | items | RAG | — | Y | — | — | |
| Website URL + crawl | A | same | same | website card | crawl APIs | crawl jobs | crawl worker | source status | Y | — | — | crawl customer status lib |
| Crawl suggestions / approval | A | same | same | suggestion rows | job APIs | suggestions JSON | apply to items | — | Y | — | — | |
| Document upload | A | same | same | upload control | `/api/voice/knowledge/.../upload` | VoiceKbSource | indexer | source status | Y | — | — | |
| Source status / retry / remove | A | same | same | table actions | source routes | DB | reindex jobs | labels | Y | — | — | `source-status-label.ts` |
| RAG searchability | B | — | — | — | search API | embeddings | retrieval tool | — | — | — | runtime |
| Unanswered questions / gaps | A | Business Knowledge | `/voice/knowledge#knowledge-gaps` | `KnowledgeGapsPanel` | `/api/voice/knowledge-gaps` | `voiceKnowledgeGap` | post-call persist | panel + detail | Y | — | — | impl branch components |
| Gap resolution + indexing | A | same | resolve form | POST resolve | gap + KB index | `resolve-gap-with-indexing` | future retrieval | Y | — | — | owner-service |
| Company Brain sync | E/I | Integrations / internal | varies | partial | — | shared layers | — | — | partial | — | out of Voice IA scope |

### D. Appointment handling

| Capability | Cls | Owner | Route | UI | API | Runtime | Result | Disc? | Evidence |
|------------|-----|-------|-------|-----|-----|---------|--------|-------|----------|
| Live booking (Microsoft) | A | Receptionist + Integrations | `/voice/receptionist`, `/integrations` | booking section + calendar connect | calendars OAuth, book tools | Graph provider | detail + analytics | Y | known-good baseline |
| Live booking (Google) | A/🟡 | same | same | same | Google OAuth | google provider | same | Y | PSTN cert pending |
| Find appointment | C/B | — | — | no separate page | `find_appointment` tool | runtime | detail actions | — | tool catalog |
| Reschedule | C/B | — | — | — | tool | runtime | detail | — | |
| Cancel | C/B | — | — | — | tool | runtime | detail | — | |
| Send booking link | A | Receptionist | `/voice/receptionist` | booking config | compile | `send_booking_link` | outcome | Y | |
| SMS booking link | C | — | — | — | SMS send pipeline | runtime | SMS + outcome | — | outbound SMS resolver |
| Request-only booking | A | Receptionist | booking section | mode select | compile | request flow | outcome | Y | |
| Message / callback fallback | A | Receptionist + CH | receptionist + CH | goals + notifications | compile | tools | outcomes | Y | |
| Calendar connection | E | Integrations | `/integrations` | calendar card + receptionist link | OAuth routes | providers | dependency rows | Y | link from receptionist |
| Calendar-required state | A | Receptionist | `/voice/receptionist` | `DependencyRow` | readiness APIs | connection state | blocks book | Y | |

### E. Emergency / after-hours operations

| Capability | Cls | Owner | Route | UI | API | Runtime | Result | Disc? | Evidence |
|------------|-----|-------|-------|-----|-----|---------|--------|-------|----------|
| Emergency identification | B/C | Call Handling + runtime | `/voice/call-handling` | urgency enable + rules | appointment-receptionist | urgency + tools | emergency outcome | Y | |
| Emergency rules | A | Call Handling | same | `UrgencyRulesEditor` | same | compile | — | Y | |
| After-hours behavior | A | Call Handling | same | `AfterHoursBehaviorEditor` | same | operating policy | — | Y | |
| On-call schedules | A | Call Handling | same | `OnCallScheduleEditor` | same | `operatingPolicy.onCallSchedule` | `authorize-transfer` | Y | CH page tail sections |
| TZ-aware schedules | A | Business Knowledge + CH | knowledge + CH | schedule editors | same | maturity | operating state | Y | |
| Overnight windows | A | same | same | schedule | same | maturity | gating | Y | |
| On-call destination selection | A | Call Handling | same | on-call entries | same | entries[].destination | transfer auth | Y | |
| Multiple on-call people | A | same | same | multiple entries | same | entries array | waterfall | Y | |
| Sequential waterfall | A | Call Handling | same | `EmergencyTransferEditor` waterfall mode | same | transfer config | Python executor | transfer table + detail | Y | |
| Destination ordering | A | same | same | editor ordering | same | state | executor | Y | |
| Ring duration | A | same | same | per-step timeouts in editor | same | transfer steps | executor | Y | `emergency-transfer-editor.tsx` |
| Direct transfer | A | same | same | per-destination mode | same | compile | executor | detail | Y | PSTN cert pending |
| Warm transfer | A | same | same | warm per step | same | compile | `_warm_transfer` | detail | Y | PSTN cert pending |
| Per-destination transfer behavior | A | same | same | editor | same | state | executor | Y | |
| Unavailable / no-answer / declined | C/B | — | — | fallback UI in editor | same | executor | transfer result | Y | runtime |
| Voicemail during escalation | C | — | — | — | runtime | executor | — | — | cert docs |
| Failed-transfer fallback | A | Call Handling | same | fallback section in `EmergencyTransferEditor` | same | `transferFallback` | executor + notify | detail + notifications | Y | |
| Emergency notifications | A | Call Handling | same | `AfterHoursNotificationsEditor` event `emergency` | compile notifications | Brevo/SMS | owner notify | Y | |
| Transfer outcome persistence | C | Calls | `/voice/calls/[id]` | transfer history | call API | DB events | post-call | detail | Y | |

### F. Caller protection

| Capability | Cls | Owner | Route | UI | Runtime | Result | Disc? | Evidence |
|------------|-----|-------|-------|-----|---------|--------|-------|----------|
| Spam Likely / carrier SCREEN | A/🟡 | Call Handling | `/voice/call-handling` | `SpamUnwantedCallsEditor` | Telnyx SCREEN hint | screening outcome | Y | cert pending on real headers |
| Spam policy | A | same | same | editor | compile | outcome Spam | Y | |
| Solicitor detection | B/C | runtime | — | policy in editor | `report_unwanted_solicitor` | Solicitor outcome | Y | |
| Solicitor policy / decline | A | Call Handling | same | editor | compile | end behavior | Y | |
| Manual blocklist | A | Call Handling + Calls | CH editor; detail block action | `/api/voice/blocked-callers` | spam-protection lib | detail | Y | |
| Block / unblock workflow | A | Calls detail | block action | block-caller API | `VoiceCallerBlock` | — | Y | |
| Unwanted solicitor reporting | C | Calls | detail / runtime | — | tool | outcome | Y | |

### G. Call termination

| Capability | Cls | Owner | Evidence |
|------------|-----|-------|----------|
| Native `end_call` | B | runtime | tool catalog; no customer toggle required |

### H. Recording

| Capability | Cls | Owner | Route | UI | Runtime | Result | Disc? | Gap? |
|------------|-----|-------|-------|-----|---------|--------|-------|------|
| Recording enable / policy | A | Call Handling | `/voice/call-handling` | `RecordingConfigCard` | egress start | — | Y | — |
| Disclosure config | A/— | same | same | card copy | provider | — | partial | if required by policy |
| LiveKit egress / persistence | B/C | runtime | — | — | recording pipeline | DB `VoiceRecording` | — | E2E not certified |
| Recording player on detail | C/🟡 | Calls | `/voice/calls/[id]` | `WaveformRecordingPlayer` | stream API | playback | Y | **P1** if ingest fails live |
| Processing / error states | C | Calls detail | pipeline state helpers | post-call | UI states | Y | |

### I. Transcript

| Capability | Cls | Owner | Route | Result | Disc? |
|------------|-----|-------|-------|--------|-------|
| Deepgram / LiveKit transcription | B | runtime | — | — | — |
| Transcript persistence | B | runtime | — | — | — |
| Visible on Call Detail | C | Calls | `/voice/calls/[id]` | transcript tab | Y |
| Retry | B/— | — | — | — | not exposed (OK) |

### J. Post-call summary

| Capability | Cls | Owner | Route | Evidence |
|------------|-----|-------|-------|----------|
| Structured AI summary | C | Calls | `/voice/calls/[id]` | `ensureCallHistorySummary` + detail |
| Deterministic facts precedence | C | Calls | detail | `customer-activity-feed`, outcome classifiers |
| Actions / appointment / callback / transfer / screening | C | Calls | detail | `buildActionItems`, badges |
| Knowledge-gap evidence | C | Calls + Knowledge | detail + gaps panel | post-call side effects |

### K. Post-call notifications

| Capability | Cls | Owner | Route | UI | Processor | Disc? | Gap? |
|------------|-----|-------|-------|-----|-----------|-------|------|
| Immediate email on completed call | A | Call Handling | `/voice/call-handling` | notifications editor | `notifyVoiceV3CallCompleted` | Y | — |
| Immediate SMS notification | A | same | same | SMS toggles | `dispatchVoiceV3Notification` | Y | — |
| Callback-requested notification | A | same | same | event row | dispatch | Y | — |
| Appointment-booked notification | A | same | same | event row | `notify-appointment-booked` | Y | — |
| Transfer outcome notification | A | same | same | transfer.* events | `notify-transfer-outcome` | Y | — |
| Emergency notification | A | same | same | emergency row | dispatch | Y | — |
| Recipients / event selection | A | same | same | recipient list | compile → runtime | Y | — |

### L. Morning / daily digest (explicit)

| Capability | Cls | Owner | Route | Finding |
|------------|-----|-------|-------|---------|
| Voice after-hours morning digest | **F** | — | — | **No Voice-specific digest UI.** Generic `processNotificationDigests` emails **unread in-app notifications** from `WorkspaceNotificationPrefs.digestFrequency` (`/settings` notifications form). Not call aggregation. |
| Enable/disable for Voice calls | F | Settings | `/settings` | workspace-level only; not Voice-branded |
| Post-call aggregation digest | J | — | — | not implemented as product |

**Answer:** An ordinary customer **cannot** discover/configure a **Voice morning/after-hours call digest** from the final six-page IA. **FEATURE EXISTS (partial) — UI EXPOSURE GAP** for product-specific digest; generic notification digest is **E** (Settings).

### M. Calls inbox

| Capability | Cls | Owner | Route | Disc? |
|------------|-----|-------|-------|-------|
| Calls list | A | Calls | `/voice/calls` | Y |
| Inbound / non-test population | A | Calls + lib | shared classifier `isReceptionistAnalyticsCall` | Y |
| Outcome / attention / filters / pagination | A | Calls | page + `NeedsAttentionView` | Y |
| Needs Attention view | A | Calls | `?attention=open`; redirect from `/voice/needs-attention` | Y |
| Shared semantics with Analytics | A | lib | `outcome-classification.ts`, `voice-analytics-aggregate.ts` | Y |

### N. Full call detail

All major surfaces **A/C** on `/voice/calls/[id]` on impl branch: outcomes, attention, callback, appointment, message, emergency, transfers, captured fields, summary, recording, transcript, technical disclosure — evidence in `page.tsx`, `detail.ts`, `customer-activity-feed.ts`.

### O. Needs attention

| Kind | Cls | Destination | Evidence |
|------|-----|-------------|----------|
| Voice attention kinds | A | Calls filter; Overview aggregate only | `VOICE_CALLS_ATTENTION_KINDS`, `voice-attention-count.ts` |
| Legacy `/voice/needs-attention` | COMPAT | redirect to Calls | impl redirect page |
| Second permanent Needs Attention nav | — | none | nav reconciliation |

### P. Analytics

| Metric | Cls | Route | Disc? |
|--------|-----|-------|-------|
| Volume, outcomes, transfers, appointments, callbacks, voicemail, duration, latency p95, usage, sentiment (threshold) | A | `/voice/analytics` | Y |
| Knowledge-gap link | A | link to `/voice/knowledge#knowledge-gaps` | Y |
| Common reasons for calling | **J/I** | not on dashboard | see §14 |

### Q. Common reasons for calling (§20)

1. **Structured call reason generated?** Partially — intake field `reason`, `insight.intent`, summary first sentence; webhook payload sets `reasonForCall: null` in `emit-post-call-webhooks.ts`.
2. **Persisted?** Intake / structured message / insight custom fields on call — not a dedicated `callReason` aggregate dimension.
3. **Deterministic vs model?** Mixed; not a canonical taxonomy.
4. **Call Detail?** Yes — “Reason for calling” in `buildCapturedFields`.
5. **Aggregated?** **No** on `/voice/analytics`.
6. **Older Analytics?** `/voice/analytics` on master redirected to MCTB — no evidence of prior “common reasons” widget on new Voice analytics.
7. **New analytics?** **Not exposed.**
8. **Verdict:** **Intentional omission** (unreliable semantics) — **not a regression** from rebuilt Voice analytics; **J** for aggregate feature, **C** for per-call display.

### R. Knowledge-gap analytics

| Item | Cls | Evidence |
|------|-----|----------|
| Open gaps / resolve / index | A | Business Knowledge panel |
| Aggregate count in Analytics | A | link + counts in analytics API on impl |
| Separate gap dashboard | I | not required |

### S. Outbound webhooks (§22)

| Layer | Finding |
|-------|---------|
| Delivery | **A/runtime** — `emitVoiceV3PostCallWebhooks` → `prisma.webhook` active hooks, `VOICE_WEBHOOK_EVENT_TYPES` |
| Configuration UI | **F** — `/integrations/webhooks` **create** flow only provisions **incoming automation** endpoints (`createIntegrationWebhook`). Outbound rows display if DB rows exist; **no UI to create outbound URL + `voice.*` event subscriptions**. |
| Discoverability from Voice | **Weak E** — Receptionist links `/integrations` for calendars; **no Voice copy/link to configure outbound Voice webhooks**. Integrations directory lists Webhooks. |

**Answer:** Customer **cannot** self-serve configure outbound Voice webhooks in final IA without admin/DB — **FEATURE EXISTS — UI EXPOSURE GAP (P1)**.

### T. Language

**B** — Multilingual conversation is model-native; no Transovo language selector on Receptionist. Prompt may include business language context where compiled.

### U. Overview

**A** — Summary-only: operational state, phone, calendar dependency, BK issues, hours, attention count, 7-day snapshot, recent calls, deep links — `voice-overview-dashboard.tsx` / `overview-summary.ts`. No config duplication per implementation report.

### V. Integrations escape hatch

**E** — Calendars: `/integrations` + receptionist dependency rows. CRM/native integrations preserved under `/integrations/*`. Voice-specific outbound webhooks **not** fully reachable (see S).

### W. Intentionally absent

| Feature | Cls |
|---------|-----|
| Human backup call center | I |
| Payment / Text-to-Pay in Voice | I |
| Mass CRM catalog | I |
| Outbound AI calling | I |
| Full daytime replacement positioning | I |

### X. Follow-up SMS (§27)

**J** — Generic post-call customer thank-you SMS not implemented as Voice product surface. Booking-link SMS and owner notifications are separate (**A/C**). MCTB is separate product.

---

## 3. Fully exposed capabilities (summary)

Ingress ownership, receptionist identity/voice/greeting/goals/intake/booking modes, business knowledge + crawl + gaps, call handling (on-call, emergency transfer waterfall, warm/direct, fallback, spam, recording config, notifications), calls inbox + detail, analytics KPIs, overview snapshot, MCTB wizard first-run (`/mctb/voice-agent`), integrations for calendars.

---

## 4. Runtime-only / correctly hidden

`end_call`, core tool execution, LiveKit session plumbing, delegated Sol, RAG retrieval internals, SCREEN header merge at SIP layer, most find/reschedule/cancel tool configuration (runtime tools, not separate pages).

---

## 5. Shared destinations

| Feature | Destination |
|---------|-------------|
| Calendars | `/integrations` (+ OAuth) |
| Outbound webhooks (display only) | `/integrations/webhooks` |
| Generic email digest prefs | `/settings` (notifications) |
| Numbers | `/voice/numbers` |
| Billing / usage | `/voice/billing` |
| Global call handler | shell switcher (not nav destination) |

---

## 6. First-run-only surfaces

| Surface | Cls | Notes |
|---------|-----|-------|
| `/mctb/voice-agent` | D | First-run; permanent state on Receptionist / CH / Knowledge |
| Full wizard at `/solutions/ai-call-handling/appointment-assistant/setup` | H/D | Legacy entry; still writes same state |

---

## 7. UI exposure gaps (F)

| Gap | Severity | Notes |
|-----|----------|-------|
| Outbound Voice webhook create/configure UI | **P1** | Runtime emits; `Webhook` model; UI creates only incoming automation endpoints |
| Voice-branded morning/daily **call** digest | **P1** | Only generic in-app notification digest in Settings |
| Recording playback E2E | **P1** | UI exists; PSTN recording ingest not certified |
| Legacy `/voice/agents` shell | **P2** | Competes with `/voice/receptionist` after nav lock |

---

## 8. Duplicate editors

| Setting | Verdict |
|---------|---------|
| Business hours | **Read-only summary** on Call Handling + canonical editor on Business Knowledge — **OK** |
| Greeting / voice / intake / booking | Receptionist vs wizard — **same API, ownership groups** — **OK (D adapter)** |
| Transfer / on-call / notifications | Call Handling vs wizard Call Handling step — **same state** — **OK** |
| `/voice/inbound-routing` vs Call Handling | **Competing advanced surface** — **H**, not duplicate editor of same fields |

No **G** duplicate permanent editors found for the same field on two six-page destinations.

---

## 9. UI controls without runtime effect (reverse audit samples)

| Control | Risk | Finding |
|---------|------|---------|
| Wizard manifest “CONFIGURED_NOT_IMPLEMENTED” rows | doc drift | On-call **does** compile to `operatingPolicy` and `authorize-transfer` consumes — manifest builder stale, not UI fake |
| `/voice/inbound-routing` rules | medium | Separate routing API; may not drive Voice V3 LiveKit path — treat as **H** legacy; verify on PSTN cert |
| Demo call IDs on Calls detail | low | Mock path labeled; real calls use API |

No widespread **fake toggles** found on the six permanent pages on impl branch.

---

## 10. Backend without UI (additional candidates)

| Backend | UI gap |
|---------|--------|
| `prisma.webhook` outbound Voice subscriptions | no create UI (§S) |
| `notification_digest` job | Settings digest only; not Voice call rollup |
| `voiceKnowledgeGap` before impl merge on master | panel on impl branch |
| AI Lead Recovery policies | MCTB product (`/mctb/...`), not Voice six-page |
| `/voice/reports` | legacy reports toggle — **H** |
| Latency profile per agent API | no permanent six-page editor — **P3** |

---

## 11. Orphan / legacy route audit (`/voice/*` on impl branch)

| Route | Class |
|-------|-------|
| `/voice/overview` | CANONICAL |
| `/voice/calls`, `/voice/calls/[id]` | CANONICAL |
| `/voice/receptionist` | CANONICAL |
| `/voice/knowledge` | CANONICAL |
| `/voice/call-handling` | CANONICAL |
| `/voice/analytics` | CANONICAL |
| `/voice/inbound-routing` | ADVANCED (legacy smart routing UI) |
| `/voice/needs-attention` | COMPATIBILITY REDIRECT |
| `/voice/operations` | COMPATIBILITY REDIRECT → call-handling |
| `/voice/analytics/after-hours` | COMPATIBILITY (redirect on impl) |
| `/mctb/voice-agent` | FIRST-RUN PROCESS |
| `/voice/agents/*` | **LEGACY BUT STILL LIVE** — competes with Receptionist |
| `/voice/setup`, `/voice/missed-calls`, `/voice/conversations` | LEGACY / MCTB overlap |
| `/voice/numbers`, `/voice/billing` | SHARED DESTINATION |
| `/voice/calendars` | redirect → integrations |
| `/integrations`, `/integrations/webhooks` | SHARED DESTINATION |

---

## 12. Cross-page semantic parity

| Pair | Status |
|------|--------|
| Calls ↔ Analytics ↔ Overview outcomes | **Shared** `outcome-classification`, `voice-analytics-aggregate`, overview period aggregate |
| Business Knowledge ↔ Call Handling hours | **Shared** wizard state / operatingMaturity; CH shows summary |
| Receptionist ↔ Wizard | **Shared** `appointment-receptionist` API + publish |
| Calls ↔ post-call pipeline | **Shared** deterministic facts, summary, recording, transcript, transfers |

---

## 13. Customer journey results

| Journey | Result | Break if any |
|---------|--------|--------------|
| A — New plumber setup | **PASS** (impl) | Without merge, breaks on master redirects |
| B — Monday morning attention | **PASS** | Overview → Calls → detail |
| C — Knowledge improvement | **PASS** | gap panel → resolve → index API |
| D — Emergency escalation | **PASS** config UI; **PSTN cert pending** runtime proof |
| E — Appointment | **PASS** with calendar connected |
| F — Spam / solicitor | **PASS** config + outcomes |
| G — Post-call visibility | **PARTIAL** — notifications OK; recording E2E **P1**; webhooks outbound config **P1**; voice digest **P1** |

---

## 14–17. Focus audits (digest, webhooks, reasons, multilingual)

Covered in §§2 L, S, Q, T.

---

## 18. P0 / P1 / P2 / P3 findings

| ID | Sev | Title |
|----|-----|-------|
| VOICE-EXP-001 | P1 | Outbound Voice webhook endpoints cannot be created/configured in UI (`voice.*` events) |
| VOICE-EXP-002 | P1 | No Voice-specific morning/daily call digest configuration in six-page IA |
| VOICE-EXP-003 | P1 | Call recording playback not PSTN-certified end-to-end despite UI |
| VOICE-EXP-004 | P2 | Legacy `/voice/agents` remains reachable parallel to `/voice/receptionist` |
| VOICE-EXP-005 | P2 | Weak Voice → Integrations path for webhooks (calendars linked; webhooks not) |
| VOICE-EXP-006 | P2 | `/voice/inbound-routing` advanced surface may confuse Call Handling ownership |
| VOICE-EXP-007 | P3 | Common reasons aggregate not on Analytics (intentional; per-call reason only) |
| VOICE-EXP-008 | P3 | Generic post-call customer SMS follow-up — future extension |

**P0:** 0 for feature logic on intended merge baseline. **Deployment P0** if nav reconciliation ships without Voice page branches (nav points at missing/stub routes).

---

## 19. P0/P1 files / components

| ID | Files |
|----|-------|
| VOICE-EXP-001 | `emit-post-call-webhooks.ts`, `webhooks-panel.tsx`, `api/integrations/webhooks/route.ts`, `loadOutboundWebhooks` |
| VOICE-EXP-002 | `lib/notifications/digest.ts`, `notifications-settings-form.tsx`, absence in `call-handling-operational-page.tsx` |
| VOICE-EXP-003 | `recording-config-card.tsx`, `waveform-recording-player.tsx`, `start-telnyx-recording.ts`, call-history cert docs |
| VOICE-EXP-004 | `src/app/(app)/voice/agents/**`, `voice-ia-nav.ts` (no agents link — good), deep links/bookmarks |

---

## 20. Recommended smallest remediation pass (do not implement in this audit)

1. **Webhooks:** Add outbound Voice webhook CRUD on `/integrations/webhooks` (or Call Handling “Developer” link) subscribing to `VOICE_WEBHOOK_EVENT_TYPES`, or document admin-only until UI ships.  
2. **Digest:** Either label Settings digest clearly as non-Voice, or add Voice call-summary digest config on Call Handling (recipients + schedule) wired to a new aggregator — product decision.  
3. **Recording:** PSTN cert + fix ingest only if cert fails — no IA change.  
4. **Legacy agents:** Redirect `/voice/agents` → `/voice/receptionist` or hide from shell when Voice V3 active.  
5. **Discoverability:** One link from Call Handling or Analytics to Integrations → Webhooks.

---

## 21. Owner browser / PSTN certification remaining

- Merge Voice page + nav branches.  
- PSTN: transfers (direct/warm/waterfall), SCREEN spam, recording playback, Google book.  
- Browser: six journeys A–G on merged build.  
- Verify inbound-routing does not override Voice V3 handler on production numbers.

---

## 37. Special questions (explicit answers)

| # | Answer |
|---|--------|
| 1 | **Yes** — on-call/waterfall from `/voice/call-handling` (`OnCallScheduleEditor`, `EmergencyTransferEditor`). |
| 2 | **Yes** — per-destination direct/warm in emergency transfer editor. |
| 3 | **Yes** — failed-transfer fallback in same editor. |
| 4 | **Yes** — `AfterHoursNotificationsEditor` includes emergency + transfer events. |
| 5 | **Yes** — `SpamUnwantedCallsEditor` on Call Handling. |
| 6 | **Yes** — same editor + runtime solicitor handling. |
| 7 | **Yes** — blocklist APIs + editor + call detail block. |
| 8 | **Yes** — `RecordingConfigCard` on Call Handling. |
| 9 | **Partial** — player on detail; **E2E not certified (P1)**. |
| 10 | **Yes** — transcript on call detail. |
| 11 | **Yes** — structured summary on detail. |
| 12 | **Yes** — captured fields + action items. |
| 13 | **Yes** — Call Handling notifications editor. |
| 14 | **No** for Voice call digest — only generic Settings digest (**P1 gap**). |
| 15 | **No** for self-serve outbound Voice webhooks (**P1 gap**). |
| 16 | **Yes** — Knowledge gaps on Business Knowledge. |
| 17 | **Yes** — resolve API + indexing core on impl branch. |
| 18 | **No** aggregate “common reasons” on Analytics. |
| 19 | **Partial** per-call reason/intake exists; **not reliable for aggregation**. |
| 20 | **Yes** — booking modes on Receptionist + calendar on Integrations. |
| 21 | **Yes** — booking-link / SMS via runtime + receptionist config. |
| 22 | **Yes** — permanent pages persist; wizard not required for edits. |
| 23 | **No** systematic dead controls found on six pages (inbound-routing legacy aside). |
| 24 | **Yes** — outbound Voice webhooks runtime without configure UI. |
| 25 | **Yes** — `/voice/agents/*` competes with canonical Receptionist. |

---

## Protected architecture

**No changes** were made to LiveKit, GPT-Live, Voice V3 tools, executors, booking providers, MCTB runtime, Prisma, or call-handling ownership during this audit.

---

VOICE CROSS-PAGE FEATURE CERTIFICATION COMPLETE — REMEDIATION REQUIRED  
P0: 0  
P1: 3  
P2: 3  
P3: 2  

- Outbound Voice webhook self-serve configuration missing  
- Voice-specific morning/daily call digest not exposed in Voice IA  
- Call recording playback not PSTN-certified end-to-end  
