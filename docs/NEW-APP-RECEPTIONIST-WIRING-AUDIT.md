# New-app AI Receptionist product wiring audit

**Scope:** Every **AI Receptionist** route, screen, modal, and shared shell dependency in `new-app/`, plus cross-product links (Phone routing, Numbers, Integrations).  
**Companion:** `docs/NEW-APP-PHONE-WIRING-AUDIT.md`, `docs/NEW-APP-PHONE-COMPLETION.md`, `docs/NEW-APP-NUMBERS-WIRING-AUDIT.md`.  
**Runtime authority (monolith — port source, not live dependency for `transovo.ai` new-app):** `docs/AI-RECEPTIONIST-WIZARD-RUNTIME-AUDIT.md`, `docs/AI-RECEPTIONIST-CONFIG-TRACING-REPORT.md`, `POST/GET /api/solutions/appointment-receptionist` in `src/`.  
**Production:** `https://transovo.ai` serves **only** `new-app`. Legacy `src/app/(app)/voice/*` and `src/app/api/voice/*` are **reference to port** into `new-app/lib/server/` + `new-app/app/api/receptionist/*` (or shared `voice/*` namespace).

**Last audited:** 2026-10-19 (repo `master`, UI under `new-app/app/app/receptionist/*`).

## Integration strategy (same as Phone)

| Not doing | Doing |
|-----------|--------|
| Browser calling legacy `/api/*` on another host from production new-app | Port domain logic into `new-app/lib/server/receptionist/` (or reuse shared `voice-call` read models) + `new-app/app/api/receptionist/*` |
| Blocking on full login / NextAuth | Bootstrap workspace via `DEV_WORKSPACE_ID` / `lib/server/workspace.ts` until auth ships |
| Rebuilding LiveKit/Telnyx runtime | Preserve monolith compile → publish → worker path; new-app is **configuration + ops UI** |
| Duplicate wizard + flat editors forever | Map `lib/agent.ts` `AgentConfig` ↔ wizard snapshot; one save/publish pipeline |

**Status legend**

| Status | Meaning |
|--------|---------|
| **Mock** | `lib/data.ts`, `lib/agent.ts` defaults, or in-memory React only |
| **Simulated** | Timers / scripted UI (no provider or DB) |
| **Toast-only** | Success toast; no API mutation |
| **Partial** | Real API for a dependency (e.g. Numbers inventory) but product core still mock |
| **Wired** | Persists and reloads from authoritative backend |
| **Target** | Monolith route / lib identified for port |

---

## 1. What `new-app` has today (Receptionist-specific HTTP)

| Layer | Reality |
|--------|---------|
| **Receptionist APIs** | **None.** No `new-app/app/api/receptionist/*`, no port of `appointment-receptionist` yet. |
| **Related APIs (shared)** | `GET/PATCH /api/phone/*` (routing — **Phone** product, not Ava coverage), `GET/PATCH /api/numbers/*`, `GET /api/health` |
| **Agent state** | `AgentProvider` — React `useState` only; `saveDraft` / `publish` are `setTimeout` simulations |
| **Call history (AI)** | `CALLS` in `lib/data.ts` with `call.ai` blocks; `CallsTable` uses fixtures when `variant !== 'phone'` |
| **Call detail (AI)** | `getCall(id)` from `lib/data.ts` — not `VoiceCall` / `humanCall` |
| **Knowledge** | `FAQS`, `GAPS`, `SOURCES` fixtures; gap “publish” updates local state only |
| **Analytics** | `AI_TREND`, `AI_INTENTS`, `GAPS` fixtures; `RangeSelect` is UI-only |
| **Test** | Scripted chat + fake PSTN test call toast |
| **Numbers on AR pages** | `NumberPicker` + `useResolvedConnection` → **Partial** via `NumbersProvider` → `/api/numbers/inventory` when inventory loads |

---

## 2. Nav and routes (canonical new-app)

From `new-app/lib/nav.ts` (product **receptionist**):

| Route | Page module | Primary components |
|-------|-------------|-------------------|
| `/app/receptionist` | `receptionist/page.tsx` | `OverviewStatus`, KPIs, attention list, `RecentCalls`, `RoutingSummary`, readiness panel |
| `/app/receptionist/calls` | `receptionist/calls/page.tsx` | `CallsTable` `variant="receptionist"` |
| `/app/receptionist/calls/[id]` | `receptionist/calls/[id]/page.tsx` | `CallDetail` + `getCall()` |
| `/app/receptionist/agent` | `receptionist/agent/page.tsx` | `AgentEditor`, `DraftBar` |
| `/app/receptionist/knowledge` | `receptionist/knowledge/page.tsx` | `KnowledgeManager` |
| `/app/receptionist/appointments` | `receptionist/appointments/page.tsx` | `AppointmentsManager`, `DraftBar` |
| `/app/receptionist/call-handling` | `receptionist/call-handling/page.tsx` | `CallHandlingEditor`, `DraftBar` |
| `/app/receptionist/test` | `receptionist/test/page.tsx` | `TestConsole` |
| `/app/receptionist/analytics` | `receptionist/analytics/page.tsx` | Charts + `GAPS` list |
| `/app/receptionist/activate` | `receptionist/activate/page.tsx` | `PublishReview` (**not in sidebar** — entry via “Review & publish”) |

**Shared components:** `components/receptionist/*`, `components/calls/*`, `components/app/routing-summary.tsx`, `components/providers/agent-provider.tsx`, `lib/agent.ts` (`AgentConfig` shape).

**Legacy monolith UI (do not duplicate long-term):** `/voice/receptionist`, `/voice/receptionist/edit`, `/voice/knowledge`, `/voice/call-handling` — see wizard audit §3.

---

## 3. Screen-by-screen audit

### 3.1 Overview (`/app/receptionist`)

| UI region | Current data / behavior | Backend needed | Monolith reference | Priority |
|-----------|-------------------------|----------------|-------------------|----------|
| Agent status card | `useAgent()` live/draft/publish timestamps | `VoiceAgent` status, draft vs published version | `GET /api/solutions/appointment-receptionist`, `GET /api/voice/overview?hub=1` | P0 |
| Connected number | `useResolvedConnection(live.connection)` | Phone assignment + `phoneNumberId` on agent | Wizard phone step, `validateReceptionistPhoneSelection` | P0 |
| KPI strip (handled, booked, transferred, attention, AHT) | `aiMetrics()` on fixture `CALLS` | Aggregates on `VoiceCall` where handler = AI / agent id | `GET /api/voice/analytics`, overview summary | P1 |
| Needs attention list | `CALLS` filter `ai.followUp === 'open'` | `GET /api/voice/needs-attention` or call list filter | `src/app/api/voice/needs-attention/route.ts` | P1 |
| Recent AI calls | `CALLS.filter(c => c.ai)` | Paginated AI-attributed calls | `GET /api/voice/calls` + filter | P1 |
| “When Ava answers” routing summary | `WorkspaceProvider.routePolicy` (**Phone** policy) | **Separate** receptionist coverage (`AgentConfig.coverage`) + optional link to Phone overflow | `GET/PATCH /api/voice/routing`, call-handling mode on number | P0 — **model split** |
| Readiness: booking calendar | `INTEGRATIONS` fixture | OAuth calendar connection state | `GET /api/voice/calendars`, integrations hub | P1 |
| Readiness: knowledge sources | `SOURCES` fixture | KB source sync status | `GET /api/voice/knowledge`, crawl jobs | P1 |
| Open gaps count | `GAPS.length` | Knowledge gap queue | `GET /api/voice/knowledge-gaps` | P1 |
| Degraded banner (Calendly / failed source) | `INTEGRATIONS`, `SOURCES` fixtures | Real integration health | Calendar + KB APIs | P2 |

**UX bug:** Stat link uses `?filter=attention` but `CallsTable` receptionist filters define `open` for “Open follow-up”, not `attention`. Fix when wiring list API.

**Popups:** None.

---

### 3.2 Calls list (`/app/receptionist/calls`)

| Control | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Row data | `CALLS` + client filter/pagination | `GET /api/receptionist/calls` or `GET /api/voice/calls?handler=ai` | `src/app/api/voice/calls/route.ts` | P1 |
| Filters (booked, transferred, failed, open follow-up, …) | Client-side on fixtures | Query params / authoritative outcome fields | Voice call DTO + AI metadata | P1 |
| Search | Client string match | Server search on caller, intent, summary | Voice calls list | P2 |
| Number filter | `NUMBERS` / owned from provider | Scope by line assigned to receptionist | Phone number id on agent | P2 |

**Note:** Phone product already uses `fetchCalls` + `mapPhoneCallDtoToCall` for `variant="phone"`. Receptionist should share a **call read pipeline** with an `ai` enrichment block (intent, outcome, tools, follow-up), not a second fake `CALLS` array.

---

### 3.3 Call detail (`/app/receptionist/calls/[id]`)

| Region | Current | Backend needed | Monolith reference | Priority |
|--------|---------|----------------|-------------------|----------|
| Page loader | `getCall(id)` fixture | `GET /api/voice/calls/[id]` or unified call detail | `src/app/api/voice/calls/[id]/route.ts` | P1 |
| AI summary, tools, transcript | From `call.ai` on fixture | `VoiceCall` events, tool traces, transcript store | Call detail + recording APIs | P1 |
| Recording player | Fixture URLs if present | Same as Phone: resolve + stream | `src/app/api/voice/recordings/*` | P1 |
| Call actions / notes | `CallActions` (may be toast/local) | Disposition, follow-up, block caller | `block-caller`, CRM hooks | P2 |

**Gap vs Phone:** Phone detail uses `getCallDetail` + Prisma `humanCall`. AI calls may be **`VoiceCall`** rows — port must not assume `humanCall` only.

---

### 3.4 Agent settings (`/app/receptionist/agent`)

| Section | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Identity, voice, greeting | `draft` in `AgentProvider` | Wizard fields → `VoiceAgent.draftConfig` | `appointment-receptionist` merge + `buildWizardAgentConfig` | P0 |
| Voice preview | `setTimeout` fake play | `POST /api/voice/tts-preview` | `src/app/api/voice/tts-preview/route.ts` | P2 |
| Style pills | Local draft | Compiled conversation style | Compiler / advanced config | P2 |
| Capabilities toggles | Local draft | `capabilities` + guardrails | `conversation-guardrails.ts` | P0 |
| Intake fields | Local draft | `collectFields` / field manifest | Config tracing report | P0 |
| Instructions / memory / CRM | Local; CRM **disabled** | CRM write flags + integration | Activate hooks | P3 |
| `DraftBar` Save | Simulated 500ms | `action=save_draft` per step or grouped | `POST /api/solutions/appointment-receptionist` | P0 |

**Popups:** Custom voice details (`<details>`), capability configure links.

---

### 3.5 Knowledge (`/app/receptionist/knowledge`)

| Tab | Current | Backend needed | Monolith reference | Priority |
|-----|---------|----------------|-------------------|----------|
| Gaps | `GAPS` + local resolve → prepends FAQ | `GET/POST /api/voice/knowledge-gaps` | `knowledge-gaps/route.ts` | P1 |
| FAQs | `FAQS` local state | KB FAQ CRUD on `VoiceKnowledgeBase` | `GET/PATCH /api/voice/knowledge/[id]` | P1 |
| Sources | `SOURCES` fixture; “Crawl” toast | Sources list, crawl job | `knowledge/crawl`, `sources` routes | P1 |
| Add FAQ button | Switches tab only | Create FAQ API | Knowledge API | P2 |

---

### 3.6 Appointments (`/app/receptionist/appointments`)

| Section | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Booking strategy / provider | Hardcoded `PROVIDERS` blurbs + draft | Calendar OAuth + strategy from wizard | Calendars OAuth routes, wizard appointments step | P0 |
| Appointment types | `draft.appointments.types` | `VoiceService` / appointment types | `GET /api/voice/services` | P1 |
| Reschedule/cancel policy | Local draft | Booking behavior flags | Wizard + compiler | P1 |
| Booking link / SMS sender | Local; sender read-only | Platform SMS sender + consent | Messaging + wizard | P2 |

**`DemoNote`:** Page still shows demo disclaimer footer.

---

### 3.7 Call handling (`/app/receptionist/call-handling`)

| Section | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Number + connection | `NumberPicker` (**Partial** live inventory) + draft `connection` | Persist `phoneNumberId`, forwarding, handler `ai_receptionist` | Wizard phone + `setActiveCallHandler` | P0 |
| Coverage mode (every call, after hours, overflow, …) | `draft.coverage` | Distinct from Phone `RoutePolicy`; sync with number routing | `GET/PATCH /api/voice/routing`, call-handling | P0 |
| Staff ring / timeout | Local draft | Ring group + seconds | Voice routing + staff | P1 |
| Transfers / triggers | Local draft + sheets | Transfer destinations table | Activate hooks, transfer policy | P1 |
| Messages / callbacks | Local draft | Message-taking policy | Wizard / runtime | P2 |
| Recovery SMS block | Local draft; test SMS toast | MCTB-style consent (**isolated product** — link only) | Recovery config; do not merge pipelines | P3 |
| Spam / protection | Local rules | Blocked callers | `GET/POST /api/voice/blocked-callers` | P2 |
| Audio / recording notices | Local `draft.audio` | Compliance copy + connection greeting | Voice V3 connection greeting docs | P2 |
| Run diagnostic | **Simulated** 1.8s → pass toast | Real SIP/LiveKit readiness | `GET /api/voice/livekit/readiness` | P1 |
| Custom schedule mode | **Disabled** UI | Weekly coverage (future) | — | P4 |
| Waterfall / on-call rotation | `NotAvailable` | Runtime pending | — | P4 |

**Popups / modals:** `NumberPicker` dialog, transfer destination sheet, recording consent dialog, recovery preview dialog.

**Cross-product:** MCTB shares number warning uses `conn?.products.includes('mctb')` from numbers data — **Partial**.

---

### 3.8 Test (`/app/receptionist/test`)

| Mode | Current | Backend needed | Monolith reference | Priority |
|------|---------|----------------|-------------------|----------|
| Draft vs live toggle | Uses `draft` / `live` from provider | Published vs draft runtime config | Agent version | P1 |
| Scenario script | **Simulated** chat + fake tool lines | — (keep as UX helper) or wire to test agent | — | P3 |
| Live PSTN test | Toast after delay | Outbound test call to user phone | `agents/[id]/test`, `v3-wizard-live-test` | P1 |
| WebRTC / browser test | Not implemented | Test session token | `templates/test-session`, LiveKit | P2 |

---

### 3.9 Analytics (`/app/receptionist/analytics`)

| Widget | Current | Backend needed | Monolith reference | Priority |
|--------|---------|----------------|-------------------|----------|
| KPI totals | Sum of `AI_TREND` fixture | Range-aware aggregates | `GET /api/voice/analytics` | P1 |
| Outcomes chart | `AI_TREND` | Time series by outcome | Analytics API | P1 |
| Intent bars | `AI_INTENTS` | Intent distribution | Analytics / call metadata | P2 |
| Knowledge gaps panel | `GAPS` | Same as Knowledge | Knowledge gaps API | P2 |
| Date range | `RangeSelect` local only | Query params + TZ | Workspace timezone | P2 |

---

### 3.10 Activate / publish (`/app/receptionist/activate`)

| Control | Current | Backend needed | Monolith reference | Priority |
|---------|---------|----------------|-------------------|----------|
| Pre-publish checks | Client rules + `FAQS` fixture | `hasBlockingActivationIssues` | `capability-checklist.ts` | P0 |
| Publish | Simulated `publish()` | `action=activate` + hooks + LiveKit/Telnyx | `runAppointmentReceptionistActivateHooks` | P0 |
| Pause agent | `setPaused` local status | Agent pause + routing fallback to Phone | Voice agent status + routing | P1 |
| Discard draft | Resets to `live` in memory | Reload draft from DB | GET receptionist API | P0 |
| “Tested” checkbox | Local state | Optional gate — product decision | — | P3 |

---

## 4. Cross-cutting systems

### 4.1 `AgentProvider` (`components/providers/agent-provider.tsx`)

| Concern | Today | Target |
|---------|-------|--------|
| Hydrate on load | `DEFAULT_AGENT` only | `GET` receptionist → map to `AgentConfig` |
| Draft vs live | Two in-memory copies | `VoiceAgent.draftConfig` vs published `VoiceAgentVersion` |
| `diffSections` | Client compare | Server revision / `wizardConfigRevision` |
| Publish | Fake delay | Activate pipeline + error `sync_failed` from API |

### 4.2 `lib/agent.ts` (`AgentConfig`)

Canonical **new-app** config model (identity, style, capabilities, intake, appointments, coverage, transfers, audio, connection). Port layer must map to/from:

- `advanced.appointmentReceptionistWizard` on `VoiceAgent.draftConfig`
- `compileReceptionistConfig` output (see `docs/AI-RECEPTIONIST-CONFIG-TRACING-REPORT.md`)

### 4.3 Phone routing vs Ava coverage

| Surface | Data source | Risk |
|---------|-------------|------|
| `RoutingSummary` on AR overview | `WorkspaceProvider` **Phone** `routePolicy` | Misleading: shows Phone ring/voicemail/MCTB, not Ava coverage modes |
| `CallHandlingEditor` | `draft.coverage` in agent | Authoritative for Ava once wired |
| Phone `/app/phone/call-handling` | Live `GET/PATCH /api/phone/routing` | Must coordinate `duringHours=ai` and `aiCoverage` with receptionist handler |

**P0 product rule:** One canonical story per number: who answers when (staff vs Ava vs voicemail) must match runtime `activeCallHandler` + routing tables.

### 4.4 Numbers

| Feature | Status |
|---------|--------|
| Pick owned / external number for draft | **Partial** — inventory API when loaded; assignment to `ai_receptionist` not persisted from AR UI |
| Verify forwarding | UI shows fixture fields on connections | Port forwarding verification from Phone/MCTB patterns |

### 4.5 Integrations (`/app/integrations`)

Referenced for calendars, Calendly, CRM. **Not audited here** — AR readiness panels assume fixture `INTEGRATIONS`.

---

## 5. Monolith port map (primary targets)

| New-app concern | Port into `new-app` | Reference monolith |
|-----------------|---------------------|-------------------|
| Load/save/publish agent | `app/api/receptionist/setup/route.ts` (or `solutions/appointment-receptionist`) | `src/app/api/solutions/appointment-receptionist/route.ts` |
| Overview KPIs | `app/api/receptionist/overview/route.ts` | `src/app/api/voice/overview/route.ts` |
| AI calls list/detail | `app/api/receptionist/calls/*` | `src/app/api/voice/calls/*` |
| Analytics | `app/api/receptionist/analytics/route.ts` | `src/app/api/voice/analytics/route.ts` |
| Knowledge + gaps | `app/api/receptionist/knowledge/*` | `src/app/api/voice/knowledge*`, `knowledge-gaps` |
| Test call / session | `app/api/receptionist/test/*` | `agents/[id]/test`, `v3-wizard-live-test` |
| TTS preview | `app/api/receptionist/tts-preview/route.ts` | `src/app/api/voice/tts-preview/route.ts` |
| Readiness / diagnostics | `app/api/receptionist/readiness/route.ts` | `livekit/readiness`, capability checklist |
| Routing / handler | Shared with Phone or `receptionist/routing` | `voice/routing`, call-handling on `PhoneNumber.settingsJson` |

Reuse monolith **libs** under `src/lib/solutions/appointment-receptionist/**` and `src/lib/voice/**` by copying into `new-app/lib/server/` (same strategy as Phone).

---

## 6. Recommended implementation order

| Phase | Deliverable | Unlocks |
|-------|-------------|---------|
| **P0** | `AgentProvider` hydrate + `save_draft` + `activate` via ported `appointment-receptionist` API | Agent, Call handling, Appointments, Activate pages become real |
| **P0** | Map `connection` + `coverage` to `phoneNumberId` + `activeCallHandler` | Number on overview; calls actually reach Ava |
| **P1** | AI calls list + detail from `VoiceCall` (shared mapper with Phone where possible) | Calls pages, attention list, gap “latest call” links |
| **P1** | Knowledge + gaps APIs | Knowledge manager + analytics gap panel |
| **P1** | Analytics aggregates | Analytics page |
| **P2** | TTS preview, live test call, diagnostics | Test + call-handling verify |
| **P2** | Fix `RoutingSummary` on AR overview to use Ava coverage (or dual-panel with Phone link) | IA truthfulness |
| **P3** | CRM write, advanced transfer modes, scenario test optional backend | Agent editor extras |

---

## 7. Verification (target — not implemented yet)

```bash
# After port (to be added):
cd new-app && pnpm test:receptionist
RECEPTIONIST_TEST_BASE_URL=https://transovo.ai pnpm test:receptionist:prod
```

Suggested prod checks (manual PSTN):

1. Publish agent → inbound to business line → Ava answers with configured greeting  
2. Book / transfer / message paths match capabilities  
3. Call appears in `/app/receptionist/calls` with transcript + tools  
4. Knowledge gap created on unknown question → resolvable in Knowledge UI  
5. Pause agent → caller hears Phone fallback (not silent failure)

---

## 8. Definition of done (parity with Phone completion doc)

**Not started.** Done when:

- No `CALLS` / `GAPS` / `FAQS` / `AI_TREND` fixtures on receptionist routes  
- `AgentProvider` is a thin client over server draft/publish  
- Every control in §3 maps to runtime or is hidden with honest `NotAvailable`  
- Cross-links to Phone/MCTB/Numbers reflect **live** entitlements and handler mode  
- Automated smoke + documented PSTN checklist pass  

Track execution in `docs/NEW-APP-RECEPTIONIST-COMPLETION.md` (checklist).
