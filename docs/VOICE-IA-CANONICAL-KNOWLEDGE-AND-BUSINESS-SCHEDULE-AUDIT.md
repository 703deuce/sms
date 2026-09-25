# Voice IA — Canonical Knowledge & Business Schedule Source-of-Truth Audit

**Date:** 2026-09-25  
**Method:** Repository search and static trace only (no UI moves, no runtime changes, no builds/browser).  
**Purpose:** Establish implementation truth for **Business Knowledge** and **Business hours / timezone** before locking Voice information architecture.

**Governing rule:** Existing implementation is evidence, not product authority. Preserve proven Voice runtime; identify canonical state; do not invent duplicate systems in this pass.

---

## Executive result

### Business Knowledge

| Question | Answer |
|----------|--------|
| **Current canonical source(s)** | **No single store.** Production Amy (Voice V3) uses a **stack**: (1) compiled **hot context** from wizard `knowledgeItems` + `operatingMaturity` hours display (`compileVoiceV3AgentConfig` → `buildLiveFrontendInstructions` BUSINESS FACTS), (2) **linked KB RAG** (`VoiceKnowledgeBase` / `VoiceKnowledgeSource` → OpenAI vector stores → LiveKit FileSearch + `executeSearchBusinessKnowledge`), (3) **`resolveBusinessAnswer` fallbacks** (wizard items, FAQ map, `loadBusinessBrain`), (4) workspace **Company Brain** (`workspace.customFieldsConfig.businessBrain`) synced on wizard save and editable at `/company-brain`. |
| **Wizard source** | `AppointmentReceptionistWizardState` on `VoiceAgent.draftConfig.advanced.appointmentReceptionistWizard` (+ `SolutionSetup` mirror). Information step: `knowledgeItems[]`, `websiteUrl`, `linkedKnowledgeBaseId`, identity/tone/greeting; **also** `BusinessScheduleEditor` (hours fact — see Part 2). |
| **`/voice/knowledge` source** | Prisma `VoiceKnowledgeBase`, `VoiceKnowledgeSource`, crawl jobs (`VoiceWebsiteCrawlJob`). Linked to agent via `linkedKnowledgeBaseId`, `VoiceAgentKnowledgeBase`, or `draftConfig.knowledgeBaseIds`. |
| **Website ingestion source** | **Two parallel paths:** (A) Wizard scan → `POST /api/voice/knowledge` `action: scan_website` → crawl job → indexed sources on KB; (B) same API from wizard immediately patches **placeholder** `knowledgeItems` (`itemsForScanResult`) with status `extracted` / `warning` (not prompt-hot until approved). Crawl **suggestions** sit on `VoiceWebsiteCrawlJob.suggestions` — **not auto-applied** to wizard. |
| **Compile path** | `resolveVoiceV3AgentConfigForAgent` → `resolveWizardSnapshotForVoiceV3` → `resolveAgentKnowledgeRetrieval` → `compileVoiceV3AgentConfig` → `hotContextFromWizard` / `knowledge.retrieval` → `buildVoiceV3Prompts` → `liveInstructions` (`buildAmyBusinessFactsSection`). |
| **Runtime retrieval path** | LiveKit: `openaiFileSearchVectorStoreIds` from compiled retrieval; tool `search_business_knowledge` → `executeSearchBusinessKnowledge` (RAG first, then `resolveBusinessAnswer`). |
| **Knowledge-gap path** | Post-call `runVoiceV3PostCallSideEffects` → `persistKnowledgeGapCandidates` → `VoiceKnowledgeGap`. Resolve in UI → `appendApprovedAnswerToKnowledgeBase` (new `VoiceKnowledgeSource` text; **reindex/processing not automatic in PATCH handler**). |
| **Relationship classification** | **B + C (Complementary with duplication):** Hot structured facts + RAG are intentional layers; **wizard items, Company Brain, and KB sources overlap** the same customer concepts with different approval rules and no single editor. |
| **Duplicate / conflicting state** | Same facts editable in wizard `knowledgeItems`, `/voice/knowledge` sources, `/company-brain`, and hire flow; hours prose in `knowledgeItems[id=hours]` vs structured `operatingMaturity.businessSchedule`; `state.timezone` vs `businessSchedule.timezone` (see Part 2). |
| **Recommended customer-facing canonical owner (no implementation)** | One **Business Knowledge** workspace concept owning: **approved facts** (Company Brain + wizard-approved items, one approval pipeline), **retrieval sources** (KB URLs/files/text as read-only attachments to that concept), **gaps** as workflow on top. Preserve V3 compile + FileSearch; **do not replace engine** — consolidate **which editor writes which layer** and eliminate duplicate editable fields for the same fact. |

### Business Hours

| Question | Answer |
|----------|--------|
| **Current canonical schedule (Voice production)** | **`operatingMaturity.businessSchedule`** on wizard snapshot → `compileVoiceV3AgentConfig.operatingPolicy.businessSchedule` → `resolveVoiceV2OperatingState` / `gateCapabilitiesForOperatingState` / transfer authorization. **Display** to Amy: `formatWeeklyHoursForAmy` via `compileBusinessHoursAmyDisplay` (structured wins over prose). |
| **Timezone source (Voice production)** | **`operatingMaturity.businessSchedule.timezone`** (via `ensureWizardOperatingMaturity`, with fallback `state.timezone` then default). Compiled into `VoiceV3AgentConfig.timezone`. **`state.timezone`** is a separate scalar (default `America/New_York` in defaults); **not updated** by `BusinessScheduleEditor` (only `businessSchedule.timezone`). |
| **Voice runtime consumer** | `effective-tool-authorization.ts`, `authorize-transfer.ts`, `compile-voice-v3-agent-config.ts` (`businessHoursWindowFromWeeklySchedule`), prompts (`formatBusinessLocalDateTime`). |
| **Appointment relationship** | **Different model.** Appointments use `booking-platform` / `staff-availability` / per–`AppointmentType` fields (e.g. `bookingHours` string) and calendar connections — **not** `operatingMaturity.businessSchedule`. |
| **MCTB relationship** | **Separate.** `MctbWeeklySchedule` / `scheduleMode` in MCTB config (`schedule-shared.ts`) controls **when MCTB sends recovery**, not Voice Amy hours. MCTB Lead Recovery FAQ uses `loadBusinessBrain` → `businessHoursSummary` (prose), **not** structured Voice schedule. |
| **Duplicate schedule state** | **Yes:** weekly structured schedule in `operatingMaturity` (edited in **Information** step and **Call Handling**); optional prose `knowledgeItems` “Hours”; Company Brain `businessHoursSummary` (synced from approved prose hours item only); legacy `state.timezone` vs schedule timezone. |
| **Recommended canonical owner (no implementation)** | **FACT:** shared workspace **business schedule** object (structured weekly + holidays + timezone) — today implemented as `operatingMaturity.businessSchedule` on the voice agent wizard snapshot, **not** yet a global Business Profile table. **BEHAVIOR:** Voice `afterHoursBehavior`, on-call, transfers remain on Call Handling / wizard call-handling. Call Handling should **reference** schedule facts, not own a second schedule editor long term. |

---

## Part 1 — Business Knowledge (detailed trace)

### 1. Customer-facing surfaces

| Surface | Component / route | API | Persistence | Fields / mechanism | Authoritative vs derived |
|---------|-------------------|-----|-------------|-------------------|---------------------------|
| Wizard Information | `steps/information-step.tsx` | `POST /api/solutions/appointment-receptionist` (`save_draft` / `activate`) | `VoiceAgent.draftConfig.advanced.appointmentReceptionistWizard` + `SolutionSetup` | `knowledgeItems[]`, `businessName`, `websiteUrl`, `linkedKnowledgeBaseId`, `knowledgeBaseEnabled`, `knowledgeSource`, agent identity, tone, greeting, behaviors, guardrails; **also** `BusinessScheduleEditor` → `operatingMaturity` | **Authoritative** for agent snapshot; items with status `extracted`/`pending_review` are **not** compiled into hot context |
| Wizard website scan | Same step | `POST /api/voice/knowledge` (`scan_website`) + wizard save | KB + crawl tables + wizard `knowledgeItems` placeholders | Creates/uses `VoiceKnowledgeBase`; enqueues `VoiceWebsiteCrawlJob`; patches placeholder items via `itemsForScanResult` | Crawl → **authoritative for RAG** when `indexed`; wizard items **derived** until customer approves/edits |
| Wizard file upload | Information step | `POST /api/voice/knowledge/:id/upload`, sources API | `VoiceKnowledgeSource` | File → source → `processKnowledgeSource` | Authoritative for RAG when indexed |
| `/voice/knowledge` | `app/(app)/voice/knowledge/page.tsx` | `GET/POST /api/voice/knowledge`, `.../sources`, `.../upload`, `.../search` | `VoiceKnowledgeBase`, `VoiceKnowledgeSource` | CRUD bases; text/url/file sources; search test | Authoritative for **retrieval**; production use requires link to agent + `resolveAgentKnowledgeRetrieval` |
| Knowledge gaps | `knowledge-gaps-panel.tsx` on Knowledge page; call detail section | `GET/PATCH /api/voice/knowledge-gaps` | `VoiceKnowledgeGap` | Open/dismiss/resolve; resolve adds text source to KB | Gaps are **derived** from post-call; resolved answer **authoritative** once indexed |
| Company Brain | `/company-brain` → `CompanyBrainSetup` | `GET/POST /api/company-brain` | `workspace.customFieldsConfig.businessBrain` | `businessName`, `website`, `defaultTimezone`, `businessHoursSummary`, `knowledgeFacts[]`, services, locations, policies | **Workspace-canonical** for shared facts; Voice wizard **syncs approved items on save** via `syncCompanyBrainFromWizard` |
| MCTB approved info | Lead Recovery UI links | `loadMctbApprovedBusinessInformation` | Reads `loadBusinessBrain` only | Prompt block for SMS FAQ | **Voice agent KB/RAG not used** (explicit in `approved-business-information.ts`) |
| Hire / Company Brain setup | `company-brain-setup.tsx` | `/api/company-brain` | Same brain JSON | Facts, website, approve | Workspace-level |

### 2. Website ingestion end-to-end

```
Customer URL (wizard Information)
  → POST /api/voice/knowledge { action: "scan_website", url, knowledgeBaseId? }
  → create/find VoiceKnowledgeBase
  → enqueueVoiceWebsiteCrawlJob → voice_website_crawl job
  → runVoiceWebsiteCrawlJob: discover URLs → VoiceKnowledgeSource per page → OpenAI vector store index
  → VoiceWebsiteCrawlJob.suggestions (extractBusinessSuggestionsFromPages) — stored on job row only

Parallel (client, immediate):
  → patch wizard knowledgeItems via itemsForScanResult (status extracted/warning, often before crawl finishes)
  → optional linkedKnowledgeBaseId set on wizard state
```

**Answers:**

| Question | Fact |
|----------|------|
| Persisted after import? | **KB:** `VoiceKnowledgeSource` rows + vector store ids; **Wizard:** `knowledgeItems` placeholders + `websiteUrl` + `linkedKnowledgeBaseId`; **Job:** `VoiceWebsiteCrawlJob` + pages + `suggestions`. |
| Discovered vs approved? | **Yes.** RAG can use indexed crawl **before** wizard items are `complete`/`owner_approved`. Hot prompt **excludes** `extracted`/`pending_review` (`buildCompactBusinessSections`, `hotContextFromWizard`). |
| Review before Amy uses? | **Hot facts:** yes (status gate). **RAG:** no — indexed website text can answer via FileSearch / `search_business_knowledge` without approving wizard cards. |
| What makes import authoritative? | **RAG:** `status: indexed` on sources + retrieval enabled + KB linked to agent. **Prompt:** approved `knowledgeItems` or Company Brain facts. |
| Re-import overwrite? | Crawl skips unchanged content hashes; wizard scan **replaces** `knowledgeItems` via `itemsForScanResult` on each scan (client patch). |
| Transformed into BusinessBrain? | **Only on wizard save** for **approved** items (`syncCompanyBrainFromWizard`). Crawl does **not** auto-write Brain. |
| Inserted into RAG? | **Yes** — primary purpose of `voice_website_crawl`. |
| Synchronized? | **Partial.** `linkedKnowledgeBaseId` links wizard to KB; **no** automatic merge of `crawlJob.suggestions` into `knowledgeItems` or Brain. |

### 3. `loadBusinessBrain(workspaceId)`

**Implementation:** `src/lib/agents/appointment-booking/business-brain.ts`

| Aspect | Detail |
|--------|--------|
| **Storage** | Primary: `workspace.customFieldsConfig.businessBrain`. Also merges **draft** `knowledgeItems` (when `opts.draftConfig` passed), **Voice KB source previews** (when `opts.agentId` + `VoiceAgentKnowledgeBase` links), plus live `voiceService`, `voiceStaffMember`, `voiceCalendarConnection`, `voiceTransferDestination`. |
| **Returns** | `BusinessBrain`: `businessName`, `website`, `defaultTimezone`, `locations`, `services`, `businessHoursSummary`, `knowledgeFacts[]`, `transferDestinations`, policies, etc. |
| **Approval filter** | Wizard items: skips `missing`, `pending_review`, `extracted`, `rejected`, `outdated`. |
| **Callers (Voice-relevant)** | `resolveBusinessAnswer` (fallback facts), `syncCompanyBrainFromWizard` / `saveBusinessBrainPartial`, `loadMctbApprovedBusinessInformation`, wizard hydrate `wizardPatchFromCompanyBrain`, `/api/company-brain`, appointment-booking `load-agent.ts`. |

**Does not contain:** structured weekly schedule (only `businessHoursSummary` prose). **Hours in Brain are not the same object as `operatingMaturity.businessSchedule`.**

### 4. Voice compilation (Appointment Receptionist → Amy)

```
VoiceAgent.draftConfig.advanced.appointmentReceptionistWizard
  → resolveVoiceV3AgentConfigForAgent (from-published-agent.ts)
  → resolveAgentKnowledgeRetrieval (KB ids, vector stores, revision)
  → compileVoiceV3AgentConfig
       hotContextFromWizard: knowledgeItems (ids business/hours/services/pricing/policies) + compileBusinessHoursAmyDisplay(structured schedule + hours item prose)
       knowledge.retrieval: enabled, knowledgeBaseIds, websiteUrl, openaiVectorStoreIds
       operatingPolicy: businessSchedule, afterHoursBehavior, onCallSchedule
  → buildVoiceV3Prompts → liveInstructions (BUSINESS FACTS section from config.business)
  → voice-v3-livekit.ts: FileSearch vector store ids on session
```

**Compiled into instructions (not dynamic retrieval):** business name context, `hoursDisplay`, services/pricing/policies summaries from approved items, extra `knowledgeItemSummaries`, persona, capabilities, transfer policy snippets.

**Retrieved dynamically:** KB/FileSearch; `search_business_knowledge` tool; `resolveBusinessAnswer` when tool path used.

**Legacy parallel:** `buildWizardAgentConfig` / `compileVoiceAgentPromptFromWizard` / Telnyx-era prompts still exist for non-V3 paths; **MCTB Voice V3 PSTN uses `compileVoiceV3AgentConfig`** per `from-published-agent.ts`.

### 5. Runtime knowledge / RAG

```
Caller business question
  → Amy (Live): BUSINESS FACTS in liveInstructions first (model policy)
  → Tool search_business_knowledge (when used)
       → executeSearchBusinessKnowledge
            → searchKnowledge per linked KB (Telnyx similarity OR OpenAI path per knowledge-processor)
            → else resolveBusinessAnswer (wizard config, FAQ, knowledgeItems, loadBusinessBrain, RAG again)
  → LiveKit native FileSearch on openaiVectorStoreIds (parallel provider tool)
  → NOT_FOUND → post-call may add knowledgeGapCandidates
```

**Precedence in `resolveBusinessAnswer`:** structured pricing/hours from config → wizard items → **company brain facts** → RAG. If `receptionistCompiled` prompt exists, core topics may return `CORE_FACT_IN_PROMPT` (delegate to instructions, not tool).

**Knowledge-gap generation:** `lib/voice-v3/call-history/summary.ts` (LLM JSON `knowledgeGapCandidates`) → `persistKnowledgeGapCandidates` in post-call side effects.

### 6. `/voice/knowledge` and production Amy

| Claim | Evidence |
|-------|----------|
| **Affects production Amy when** | Agent has `linkedKnowledgeBaseId` or `VoiceAgentKnowledgeBase` links; sources reach `indexed`; `resolveAgentKnowledgeRetrieval` sets `retrieval.enabled`; `useGptLiveFileSearchRag()` true → vector stores passed to LiveKit session (`voice-v3-livekit.ts`). |
| **Not sufficient alone** | Creating a KB in `/voice/knowledge` without linking to the active agent does **not** change that agent’s compiled `knowledgeBaseIds`. |
| **Legacy vs canonical** | Page is **operational canonical for RAG assets**; wizard is **canonical for hot facts + link field**. Not legacy — **production**, but **under-linked** if customers only use one surface. |
| **Gaps** | Real post-call pipeline; resolving with `answerText` creates `VoiceKnowledgeSource` (`appendApprovedAnswerToKnowledgeBase`) — **Amy uses it after indexing/processing**; PATCH does not call `processKnowledgeSource` in the handler (potential lag). |

### 7. Relationship classification

**Primary: B (Complementary)** — Structured hot context + vector RAG + gap workflow are different layers by design.

**Also C (Duplicated)** — Wizard `knowledgeItems`, Company Brain facts, and KB text/url/file can all hold “hours”, “services”, “policies” with **no single write path**.

**Not D** — `/voice/knowledge` is consumed when linked and indexed.

**Not A** — Wizard and Knowledge page are **not** one state; they are linked by IDs and jobs.

### 8. Product ownership recommendation (preserve runtime)

- **One customer concept:** “What Amy knows.”
- **Under the hood (keep):** `compileVoiceV3AgentConfig` hot context + FileSearch/RAG + post-call gaps.
- **Consolidate presentation:** Single approval queue for facts that feed hot context **and** optional “attach source document” for RAG.
- **Company Brain** remains the right **workspace** store for cross-product facts (`field-ownership.ts` intent); wizard save should remain a **deployment sync**, not a second manual editor long term.
- **Do not** merge KB vector index into wizard JSON; **do** require explicit link + one “website import” story.

---

## Part 2 — Business Hours / Timezone (detailed trace)

### 9. Editors (customer-facing)

| Location | Component | API | Persistence | Notes |
|----------|-----------|-----|-------------|-------|
| Wizard Information | `BusinessScheduleEditor` in `information-step.tsx` | `appointment-receptionist` save | `operatingMaturity.businessSchedule` (+ holidays), `state.timezone` unchanged | **Duplicate surface** with Call Handling |
| Wizard Call Handling / ops | `operating-maturity-editor.tsx` on call-handling step + `/voice/call-handling` | Same | Same `operatingMaturity` on wizard snapshot | Authoritative for Voice runtime |
| Wizard defaults | `defaults.ts` | — | `timezone: America/New_York`, `DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG` | Initial state |
| Company Brain | `/company-brain` | `/api/company-brain` | `businessBrain.defaultTimezone`, `businessHoursSummary` | **Prose hours only**; synced from approved `knowledgeItems` hours on wizard save |
| Knowledge item “Hours” | Information step cards | Wizard save | `knowledgeItems[id=hours].summary` | **Conversational prose**; conflicts possible with structured (`compileBusinessHoursAmyDisplay`) |
| MCTB | Setup / recovery (not Voice nav) | MCTB APIs | `MctbWeeklySchedule`, `scheduleMode` | **Different product** — recovery send window |
| Appointments | Types, staff availability, locations | Appointments APIs | `AppointmentType.bookingHours`, staff schedules, `booking-platform.timezone` | **Appointment availability**, not Voice operating policy |
| Settings / business profile | No dedicated global business-hours page found in `settings/` grep for this audit | — | — | **No shared Transovo business-profile schedule table** located beyond Company Brain prose + voice wizard JSON |

### 10. Voice business-hours runtime

```
operatingMaturity.businessSchedule (wizard snapshot)
  → compileVoiceV3AgentConfig: businessHours window + operatingPolicy
  → resolveVoiceV2OperatingState({ schedule: policy.businessSchedule, at })
  → gateCapabilitiesForOperatingState(behavior: afterHoursBehavior)
  → Tools: book/transfer/message/callback allowed or blocked per after-hours matrix
  → Transfer: authorize-transfer.ts uses same schedule + onCallSchedule
```

**Authoritative for production:** **`operatingPolicy.businessSchedule`** on compiled `VoiceV3AgentConfig`, sourced from wizard `operatingMaturity`.

**Amy “what are your hours?” (spoken):** `business.hoursDisplay` from **structured** schedule when present; else prose from `knowledgeItems` hours (`business-hours-display.ts`).

### 11. Fact vs behavior

| Layer | Stored in | Example |
|-------|-----------|---------|
| **FACT** | `operatingMaturity.businessSchedule` (weekly + holidays + timezone) | Mon–Fri 8–5 Eastern |
| **FACT (secondary / legacy prose)** | `knowledgeItems` “Hours”, `businessBrain.businessHoursSummary` | “Monday through Friday 9 to 5” |
| **BEHAVIOR** | `operatingMaturity.afterHoursBehavior.whenClosed.*` | Allow message, block live booking, allow on-call escalation |
| **BEHAVIOR** | On-call, urgency, transfers, notifications | Same wizard `operatingMaturity` + call-handling fields |

**Duplication:** The **same** `operatingMaturity` object is edited in **two wizard locations** (Information + Call Handling) — same fact, not two models, but **two UIs**.

**Mismatch:** Company Brain and MCTB use **prose** `businessHoursSummary`, not structured schedule.

### 12. Appointments

- **Does not read** `operatingMaturity.businessSchedule` for slot generation in the traced paths.
- Uses **calendar connections**, **staff availability**, service location timezone, and per-type **`bookingHours`** strings.
- **Business hours ≠ appointment availability** in current code.

### 13. MCTB

- **Own schedule** for when automated recovery runs (`MctbWeeklySchedule`).
- Lead Recovery FAQ text uses **`loadBusinessBrain`** (prose hours), not Voice structured schedule.
- **Risk:** Owner sets Voice hours in Call Handling but MCTB/recovery schedule or Brain prose diverges.

### 14. Canonical ownership recommendation

- **FACT owner (target):** One workspace **business schedule** record (today: `operatingMaturity.businessSchedule` on voice agent config; candidate to promote to shared profile later).
- **Timezone:** Single field tied to that schedule (`businessSchedule.timezone`); deprecate orphan `state.timezone` for display/sync or keep it a synced mirror.
- **Prose hours card:** Either derived read-only from structured schedule or clearly labeled “customer-facing wording override” with conflict warnings (already computed: `hoursProseConflictsWithStructured`).
- **Call Handling:** Consumes schedule + owns **after-hours behavior** only; “Manage business hours” deep link to canonical fact editor.
- **Company Brain `businessHoursSummary`:** Should be **generated or synced from structured schedule**, not independently edited, unless IA chooses prose-only businesses.

---

## Part 3 — Orphans and collisions

| Issue | Detail |
|-------|--------|
| Duplicate business name | `state.businessName`, `CompanyBrain.businessName`, compiled `businessName` |
| Duplicate description | `knowledgeItems[business]`, `companyDescription` in hot context, KB crawl text |
| Duplicate timezone | `state.timezone` vs `operatingMaturity.businessSchedule.timezone` vs `CompanyBrain.defaultTimezone` — **compile uses schedule; Brain sync uses `state.timezone`** |
| Duplicate weekly hours | `operatingMaturity.businessSchedule.weekly` vs prose hours item vs `businessHoursSummary` |
| Duplicate website | `state.websiteUrl`, Brain `website`, KB crawl URL sources |
| Duplicate FAQs | `knowledgeItems`, Brain `knowledgeFacts`, KB text sources, gap-resolve sources |
| Stale UI copy | Information `InfoCallout` references Telnyx for all answering — **V3 primary path is compile + OpenAI FileSearch** |
| `operatingMaturity` missing from `field-ownership.ts` | Schedule ownership not documented in migration matrix |
| Crawl `suggestions` orphan | Written to job row; **no UI merge** into wizard in traced code |
| Gap resolve without reindex | Source created as `active`; may not enter RAG until processor runs |

---

## Collision matrix

| Concept | Editor A | Editor B | Persistence A | Persistence B | Runtime consumer | Collision? |
|---------|----------|----------|---------------|---------------|------------------|------------|
| Business name | Wizard Information | Company Brain | `wizard.businessName` | `customFieldsConfig.businessBrain.businessName` | `config.businessName`, prompts | **Yes** — sync on save, dual edit |
| Business description | Wizard `knowledgeItems[business]` | KB text / crawl | wizard items | `VoiceKnowledgeSource` | hot context + RAG | **Yes** |
| Website | Wizard URL + scan | `/voice/knowledge` URL source | `websiteUrl` + KB | crawl sources | retrieval.websiteUrl + RAG | **Partial** — linked by KB id |
| Services | Wizard items / appointment types | Brain `services` / `voiceService` | wizard + DB services | brain + prisma | hot context + brain fallback | **Yes** |
| Service areas | Wizard items (if present) | KB / brain facts | items | sources / facts | RAG + resolveBusinessAnswer | **Possible** |
| Policies | Wizard `knowledgeItems[policies]` | KB / brain | items | sources / facts | hot context | **Yes** |
| FAQs | Wizard items / brain | KB / gap resolve | items / facts | sources | hot + RAG | **Yes** |
| Timezone | `BusinessScheduleEditor` | `state.timezone` (default only) | `businessSchedule.timezone` | `wizard.timezone` | `config.timezone`; Brain `defaultTimezone` from **state.timezone** | **Yes** |
| Weekly hours | `BusinessScheduleEditor` (Information + Call Handling) | Hours knowledge card | `operatingMaturity.businessSchedule` | `knowledgeItems[hours]` prose | Structured for gating + `hoursDisplay`; prose for fallback | **Yes** |
| Holiday hours | `BusinessScheduleEditor` | — | `businessSchedule.holidays` | — | operating state | No second editor |

---

## Runtime truth matrix

| Customer concept | Authoritative state | Production Voice consumes? | Customer can edit? | Canonical UI today |
|------------------|---------------------|---------------------------|--------------------|--------------------|
| Business name | Wizard + Brain (synced on save) | Yes (prompt) | Yes | Wizard Information / Company Brain |
| Hours (spoken) | Structured schedule → `hoursDisplay`; else prose item | Yes | Yes (2+ places) | Information + Call Handling + hours card |
| Hours (after-hours gating) | `operatingMaturity.businessSchedule` | Yes | Yes | Information + Call Handling |
| Services / pricing / policies (spoken) | Approved `knowledgeItems` | Yes (hot context) | Yes | Wizard Information |
| Long-tail / doc Q&A | Indexed `VoiceKnowledgeSource` | Yes (FileSearch + tool) | Yes | `/voice/knowledge` + wizard upload |
| Website crawl content | KB sources | Yes (when linked + indexed) | Indirect (URL scan) | Wizard scan + Knowledge page |
| Company facts (workspace) | `businessBrain` | Fallback in `resolveBusinessAnswer`; MCTB FAQ | Yes | `/company-brain` |
| Knowledge gaps | `VoiceKnowledgeGap` | Drives follow-up content after resolve | Yes | Knowledge gaps panel |
| Timezone (call logic) | `businessSchedule.timezone` | Yes | Yes (schedule editor) | BusinessScheduleEditor |
| After-hours behavior | `afterHoursBehavior` | Yes | Yes | Call Handling |

---

## IA recommendation (ownership only — no page redesign)

1. **Business Knowledge:** One customer workspace combining **Approved facts** (Brain + wizard-approved items, single approval UX) and **Sources** (KB list linked to agent). Keep V3 compile + FileSearch unchanged.
2. **Business hours FACT:** Single editor for `operatingMaturity.businessSchedule` (+ timezone); remove duplicate **Information** step schedule block when IA moves — until then, treat **Call Handling + Information as same data** (already is).
3. **Prose hours card:** Read-only derivative or explicit override with conflict surfacing.
4. **Company Brain:** Workspace truth for cross-product strings; Voice wizard becomes **sync target**, not parallel manual editor for the same labels.
5. **MCTB:** Do not conflate with Voice schedule; optionally **read** structured hours export later.

---

## Risks

- Amy speaks **structured hours** while Company Brain / MCTB FAQ show **prose** out of sync.
- Website RAG answers **before** customer approves wizard cards (by design today).
- `state.timezone` and `businessSchedule.timezone` diverge → wrong Brain `defaultTimezone` vs call logic.
- Editing schedule only in Information vs only in Call Handling — **same JSON**, but customers may not know.
- Gap resolution adds KB text without guaranteed reindex → stale RAG.
- Multiple KBs / missing `linkedKnowledgeBaseId` → `/voice/knowledge` work unused at runtime.

---

## Final answers

1. **Production source of truth for what Amy knows?** **Layered:** compiled hot context from wizard-approved `knowledgeItems` + structured hours display + linked indexed KB (FileSearch/tool) + fallbacks (`resolveBusinessAnswer`, Company Brain).
2. **Does `/voice/knowledge` affect production Amy?** **Yes, when** KB is linked to the agent and sources are indexed and retrieval is enabled.
3. **Does wizard Business Information affect production Amy?** **Yes** — primary hot facts and schedule; extracted items excluded until approved.
4. **Does website ingestion affect production Amy?** **Yes for RAG** after crawl indexes; **wizard placeholders alone** do not hot-compile until approved; crawl suggestions do not auto-apply.
5. **Structured facts vs RAG complementary or duplicated?** **Both** — complementary by architecture, duplicated in customer-facing editors.
6. **Single customer-facing knowledge concept should own?** Approved facts + linked sources + gap resolution workflow (one mental model; multiple stores OK under the hood).
7. **Production source of truth for business hours?** `operatingMaturity.businessSchedule` on the voice agent wizard snapshot → `operatingPolicy.businessSchedule` in Voice V3 config.
8. **Production source of truth for timezone?** `operatingMaturity.businessSchedule.timezone` (with `ensureWizardOperatingMaturity` fallback chain).
9. **Does Voice duplicate business hours?** **Yes** — structured schedule + prose hours item + Brain summary + two UI editors (Information + Call Handling).
10. **Appointments same schedule?** **No** — separate availability model.
11. **MCTB depend on same schedule?** **No** — separate MCTB weekly schedule; Brain prose only overlap for FAQ.
12. **Which model/editor should become canonical?** **Facts:** Company Brain + wizard-approved items (converging); **Schedule:** `operatingMaturity.businessSchedule` (promote to shared business profile over time); **RAG:** `VoiceKnowledgeBase` / sources; **Behavior:** Call Handling `afterHoursBehavior` / on-call / transfers.
13. **Fake/disconnected controls?** **Partially:** Information callout overstates Telnyx-only path for V3; **timezone scalar** may be stale vs schedule editor; gap resolve may lag RAG without reindex; crawl **suggestions** have no customer UI.

---

## Verdict

**SOURCE TRUTH CONFLICT FOUND — RESOLVE BEFORE LOCKING VOICE IA**

### Exact conflicts to resolve in IA (not in this pass)

1. **Hours fact triple representation:** structured `businessSchedule` vs `knowledgeItems[hours]` prose vs `CompanyBrain.businessHoursSummary` (and MCTB FAQ prose).
2. **Timezone dual fields:** `state.timezone` (Brain sync) vs `businessSchedule.timezone` (Voice runtime).
3. **Business knowledge triple write:** wizard `knowledgeItems`, Company Brain, KB sources — overlapping editable content without one approval owner.
4. **Website import dual outcomes:** immediate wizard placeholders vs async KB index — RAG can be live while hot cards still say “extracted”.
5. **Schedule editor duplicated** in Information and Call Handling (same persistence — IA clarity issue).
6. **`operatingMaturity` omitted** from documented field-ownership matrix vs Company Brain prose hours.

---

*End of audit. No code, routes, or runtime modified.*
