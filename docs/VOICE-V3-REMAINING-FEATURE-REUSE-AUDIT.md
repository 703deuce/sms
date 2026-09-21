# Voice V3 — Remaining Feature Reuse Audit

**Date:** 2026-09-21  
**Scope:** Repository-wide discovery (current `master` tree + git history). **Audit only — no implementation.**  
**Excluded:** Calendly, Google Calendar (separate audit/implementation), intake redesign, tool idle filler, Microsoft booking rewrite, broad service-hours/after-hours engine, V1/V2 voice runtime resurrection.

**Baseline architecture (unchanged):** Telnyx PSTN → LiveKit → GPT-Live (`gpt-live-1`, delegation) → GPT-5.6 Sol → FunctionTools → `src/lib/voice-v3/**` → provider executors.

---

## 1. EXECUTIVE SUMMARY

| Feature area | Class | ~% exists | Actual remaining work |
|--------------|-------|-----------|------------------------|
| **1. Booking persistence / post-book** | **C** | ~75% | Provider BOOK + `BOOKING_CONFIRMED` complete; **Postgres `VoiceCall` / `voice_appointments` / CRM / notifications** exist elsewhere (`markVoiceCallBooked`, legacy `voice/calendar/booking.ts`, integrations persist). **Thin hook after V3 `BOOKING_CONFIRMED`** — do not touch Graph commit. |
| **2. Transfer system** | **B–C** | ~85% | Wizard compile + Node `authorizeVoiceV3Transfer` + Python waterfall/warm/DIRECT + `WarmTransferTask` **already implemented**. Gaps: published snapshot / empty destinations, per-step modes from wizard, return-to-AI after exhaust, PSTN cert of warm path. |
| **3. Wizard → Live V3 config** | **B–C** | ~70% | `compileVoiceV3AgentConfig` + `from-published-agent` + wizard snapshot resolver **substantial**. Gaps: frozen env fallback when wizard missing; `instructions.system` not in Live prompt; hot-context vs full persona; some manifest fields still “future consumer”. |
| **4. Website / RAG / business knowledge** | **D** (on `master`) / **B** (on branches) | **Master ~40%** / **Branches ~90%** | **Master:** single-URL `scan_website` → Telnyx RAG + wizard `knowledgeItems` summaries in prompts. **Not on `master`:** sitemap + **~100-page** crawl, `search_business_knowledge`, GPT-Live file_search wiring (commits on `cursor/voice-v3-gap-closure-2304` / `cursor/voice-v3-final-completion-2304`). |
| **5. Conversation freshness** | **C** | ~65% | Revision counters, delegation supersession, stale tool results, tests **exist**. Gaps: `markCallerTurnSemanticApplied` never called; Responses `cancel` not wired; some READ paths vs COMMITTED_WRITE policy. |
| **6. Tool execution / forensics** | **C** | ~70% | Python forensics batch + Node `forensics-persist` + `VoiceCall.metadata.voiceV3Forensics` **exist**. Gaps: **`VoiceToolExecution` not written on V3 Node tool path**; rich booking fields not in forensic payloads. |
| **7. REQUEST_ONLY / qualification / urgency / callback** | **D** (master) / **B** (branch) | **Master ~35%** / **Branch ~85%** | **Master:** `request_callback` + compile of qualification/urgency **config only**. **Not on `master`:** executors (`submit_appointment_request`, evaluators, service policy gates) — **`d275f9c3` on gap-closure branch**. |
| **8. Send booking link** | **A–B** | ~90% | `execute-send-booking-link.ts`, tool, SMS, authorization for `SEND_LINK` **on master**. Minor: manifest labels, env vs published telephony edge cases. |

---

## 2. BOOKING PERSISTENCE

### Classification: **C** — substantially implemented elsewhere; V3 wiring missing

### Existing code (reuse)

| Component | Location | Role |
|-----------|----------|------|
| `markVoiceCallBooked` | `src/lib/voice/runtime-provider/livekit-call-telemetry.ts` | Sets `VoiceCall.appointmentBooked`, links `voice_appointments` by `appointmentId` or `externalId`, trace event, async `notifyVoiceV3AppointmentBooked` |
| `notifyVoiceV3AppointmentBooked` | `src/lib/voice-v3/notifications/notify-appointment-booked.ts` | Staff notifications (config-driven) |
| `voiceAppointment.create` + call flag | `src/lib/voice/calendar/booking.ts` (~889+) | **Legacy voice calendar** — full row + `appointmentBooked` after provider insert |
| `persistAppointmentFromIntegration` | `src/lib/integrations/framework/product-persist.ts` | Provider-neutral `voice_appointments` upsert pattern |
| `markVoiceCallBooked` + persist | `src/lib/integrations/framework/actions-registry.ts` (Calendly scheduling API path) | Product persist then mark call booked |
| `commit-booking-for-python.ts` | `src/lib/voice/python-runtime-bridge/` | `markVoiceCallBooked` + `syncFrontDeskBookingToCrm` + confirmation SMS |
| `syncFrontDeskBookingToCrm` | `src/lib/voice/crm/frontdesk-crm-sync.ts` | CRM bus after book |

### Current V3 pipeline (intentionally stops early)

| Step | Location |
|------|----------|
| Revalidate + provider commit | `src/lib/voice-v3/calendar/book-dispatch.ts` |
| `BOOKING_CONFIRMED` + in-memory registry | `registerDurableBooking` → `src/lib/voice-v3/calendar/durable-booking-store.ts` (**process-local `Map` only**) |
| Tool success | `src/lib/voice-v3/tools/book-appointment-tool.ts` (returns `provider_event_id`; **no DB**) |

**No references** to `markVoiceCallBooked`, `voiceAppointment`, or `appointmentBooked` under `src/lib/voice-v3/**` (verified by search).

### Reusable components (unchanged)

- `markVoiceCallBooked` + notification loader — **provider-neutral** if passed `appointmentId` / `externalId` (today `externalId` path assumes `calendly:` prefix in one branch — **Microsoft/Google need explicit `appointmentId` or normalized `externalId`**).
- `persistAppointmentFromIntegration` or a thin wrapper mapping `ConfirmedBooking` → row fields (`externalId`, `metadata.providerEventId`, `callId`, `contactId`).
- Optional: `syncFrontDeskBookingToCrm` **after** row exists (same pattern as python bridge).

### Missing V3 connection (exact)

1. **After** `BOOKING_CONFIRMED` in `book-dispatch.ts` (or single post-commit helper invoked from there): create/update `voice_appointments`, set `VoiceCall.appointmentBooked`, attach `providerEventId` to call metadata/forensics — **without** altering Microsoft/Google provider commit functions.
2. Replace or supplement in-memory `registerDurableBooking` for **cross-restart** management flows OR keep in-memory for same-call RESCHEDULE/CANCEL but still persist for reporting.
3. Fire-and-forget `markVoiceCallBooked` (already async notification inside).

### Provider neutrality

**Yes** — persistence layer should key off `ConfirmedBooking.provider`, `providerEventId`, `providerCalendarId`, times, and `callId`/`workspaceId`; same hook for Microsoft and Google.

---

## 3. TRANSFER

### Classification: **B–C** — core stack built; wizard/runtime alignment gaps

### Existing implementation

| Layer | Location | Notes |
|-------|----------|-------|
| Wizard state | `src/lib/solutions/appointment-receptionist/types.ts` | `transferDestinations`, `transferPlanSteps`, `warmTransfer`, `transferRouting`, triggers, fallback |
| Compile | `compileVoiceV3TransferPolicyFromWizard` in `src/lib/voice-v3/transfer/compile-transfer-config.ts` | Destinations, waterfall vs single, plan steps, modes BASIC/WARM |
| Agent config | `compile-voice-v3-agent-config.ts` | `transfer`, `transferDestinations` |
| Authorization | `src/lib/voice-v3/transfer/authorize-transfer.ts` | Route/destination validation, handoff text, execution plan for Python |
| Tool | `src/lib/voice-v3/tools/transfer-call-tool.ts` | Zod enums from compiled routes/destinations |
| Python execution | `voice-runtime-python/.../transfer_executor.py` | **DIRECT** (`transfer_sip_participant` + `ringing_timeout`) and **WARM** (`WarmTransferTask`), **waterfall** over targets, billing/outcome callbacks |
| Legacy warm jobs | `src/lib/voice/transfers.ts`, `src/lib/jobs/job-handlers.ts` | Voice V2 warm timeout handlers (preserve; not V3 primary) |
| Docs/tests | `docs/VOICE-V3-TRANSFER-*`, `scripts/test-voice-v3-transfer-system.ts` | |

### What reaches LiveKit / Python

Published wizard → `resolveVoiceV3AgentConfigForAgent` → `config.transfer` on session → `transfer_call` tool → Node authorize → Python `execute_authorized_transfer_plan`.

### Warm transfer / waterfall

**Already exist** in Python when compiled plan sets `mode: "WARM"` and multiple targets. Prior gap register statement “cold only” is **stale relative to current Python**.

### Actual gaps

1. **Wizard → runtime empty destinations** — `from-published-agent` / publish snapshot / phone E.164 normalization failures → `TRANSFER_NOT_CONFIGURED` at runtime despite UI data (see `docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md`).
2. **Per-destination mode** — compile defaults `defaultWarm` globally; `transferPlanSteps[].transferMode` mapped in compile but **certification** on real PSTN warm + SIP trunk/caller ID.
3. **Return-to-AI / fallback** — `map-fallback.ts`, exhausted transfer logging; **caller experience** after `VOICE_V3_TRANSFER_EXHAUSTED` needs product verification.
4. **Semantic routes / triggers** — compiled `route.description` from triggers; model must pass `route_id` — no separate keyword router (by design).

---

## 4. WIZARD → LIVE V3 CONFIG

### Classification: **B–C**

### Pipeline (current)

```
SolutionSetup / VoiceAgentVersion
  → advanced.appointmentReceptionistWizard (published or TESTING draft)
  → resolveWizardSnapshotForVoiceV3 (src/lib/voice-v3/config/resolve-wizard-snapshot-for-v3.ts)
  → compileVoiceV3AgentConfig
  → LiveKit session bootstrap / GPT-Live instructions (build-voice-v3-prompts.ts, live-frontend-instructions.ts)
  → Sol backend (astra-backend-instructions.ts)
```

### Setting trace (selected)

| Setting | Wizard storage | Publish | V3 compile | Live session |
|---------|----------------|---------|------------|--------------|
| Business name, timezone, services | wizard state | snapshot in `VoiceAgentConfig.advanced` | `business`, `scheduling`, `services` | Hot context + FIND/BOOK |
| Agent name | `agentName` | snapshot | `identity.agentName` | `resolveVoiceV3DefaultPromptInput` — **falls back to env if config missing** |
| Voice / language | `voiceId`, `voiceLanguage`, telephony fields | snapshot | `telephony.*` | Live voice id resolution in compile |
| Greeting | `connectionGreeting*` | snapshot | `telephony.connectionGreeting*` | Worker/greeting path |
| Capabilities | `capabilities[]` | snapshot | capability flags + tool auth | Tool catalog |
| Booking strategy | `bookingStrategy` / appointment types | snapshot | `scheduling.bookingStrategy` | Tool auth + dispatch |
| Calendar | provider + connection | snapshot + DB connections | `calendar.*` | FIND/BOOK |
| Transfer | destinations, plan | snapshot | `transfer`, `transferDestinations` | `transfer_call` |
| Callback | `callbackRequestsEnabled`, collect fields | snapshot | `operationRequirements.request_callback` | `request_callback` tool |
| Knowledge summaries | `knowledgeItems`, `websiteUrl` | snapshot | `business.*`, `knowledge.retrieval` | Prompt hot context |
| Qualification / urgency | wizard fields | snapshot | `qualification`, `callHandling.urgency*` | **Config on master; executors on branch** |
| Custom instructions | `instructions.system` (Front Desk compile) | `compileVoiceAgentPromptFromWizard` on **Telnyx/V2 path** | **Not loaded into V3 Live instructions** | Gap |

### Frozen / default risk

`VOICE_V3_BOOKING_AGENT_CONFIG` (`booking-agent-config.ts`) used when wizard resolution fails — env-driven Amy/Transovo demo config.

### Smallest wiring gaps (no prompt redesign)

1. Ensure published receptionist **always** resolves wizard (no silent env fallback in production).
2. Map `instructions.system` / business tone into **existing** Live prompt slots (not a new prompt architecture).
3. Reconcile manifest “future consumer” flags with what compile already sets.

---

## 5. WEBSITE / RAG / BUSINESS KNOWLEDGE

### Classification

- **On `master`:** **D** for full remembered product (sitemap + ~100 pages + runtime RAG tool); **B** for wizard scan + prompt summaries.
- **Off `master` (git):** **B** — implementation exists on branches; needs merge/cherry-pick, not greenfield crawler.

### On `master` today

| Piece | Location |
|-------|----------|
| Wizard UI scan | `information-step.tsx` → `POST /api/voice/knowledge` `action: "scan_website"` |
| API | `src/app/api/voice/knowledge/route.ts` |
| Processing | `src/lib/voice/knowledge-processor.ts` — Telnyx RAG sync, chunking, **single URL** per source |
| KB models | Prisma `voiceKnowledgeBase`, `voiceKnowledgeSource` |
| Compile | `knowledge.retrieval.enabled`, `knowledgeBaseIds`, `websiteUrl` in `compile-voice-v3-agent-config.ts` |
| Prompt injection | `hotContextFromWizard` / `live-frontend-instructions.ts` — **summaries in prompt**, not dynamic retrieval tool on master |
| Business brain | `src/lib/agents/appointment-booking/business-brain.ts` — approve imported facts; `activate-hooks.ts` syncs website line |

**No `sitemap` string matches on `master`.** No `src/lib/voice-v3/knowledge/**` directory on `master`. No `search_business_knowledge` tool on `master`.

### Remembered sitemap + ~100 pages — **exists in git, not on `master`**

| Commit | Branch context | What |
|--------|----------------|------|
| **`55e48438`** | `cursor/voice-v3-final-completion-2304` (not ancestor of `master`) | `src/lib/voice-v3/knowledge/website-crawl/*` — `MAX_USEFUL_PAGES = 100`, `discoverSameOriginUrls`, sitemap.xml + sitemap_index, same-origin, prioritize, `run-crawl-job.ts`, API `crawl/[jobId]`, test `test-voice-v3-website-crawl.ts` |
| **`affb98c5`** | gap-closure / final-completion | `resolve-agent-knowledge-retrieval.ts`, Astra knowledge instructions, compile hooks |
| **`0ad68d4e`** | gap-closure | GPT Live `file_search` RAG via LiveKit |
| **`6f0c8044`** | gap-closure / final-completion | **Separate** `business-import` pipeline — ScrapingDog, `crawl.ts` with **`MAX_PAGES = 15`**, sitemap discovery, wizard review UI — **not the same as 100-page knowledge crawl** |

### Do not rebuild

- Telnyx RAG processor, KB tables, wizard scan endpoint.
- Website-crawl module on `55e48438` — **merge/adapt** behind V3 config.

### Prevents V3 from using it (today)

1. Code not on `master` production line.
2. No runtime tool wired on master to query KB during calls.
3. Hot-context-only answers for scraped summaries; long-tail site content needs retrieval path from branch work.

---

## 6. CONVERSATION FRESHNESS

### Classification: **C**

### Existing

| Mechanism | Location |
|-----------|----------|
| Conversation revision | `conversation-revision.ts`, `caller-turn-manager.ts` |
| Delegation snapshot | `live-response-coordinator.ts`, `handle-delegated-voice-tools.ts` |
| Semantic supersession | `delegation/conversation-freshness.ts`, `buildSemanticSupersededToolResult` |
| Scheduling generation stale ops | `operations/registry.ts`, find-dispatch stale transitions |
| Tests | `test-voice-v3-conversation-freshness*.ts`, matrix cert |

### Gaps

1. **`markCallerTurnSemanticApplied`** — defined in `caller-turn-manager.ts`, **no callers** in repo (delegation path does not advance `lastSemanticAppliedSequence`).
2. **OpenAI Responses HTTP cancel** — documented in `docs/VOICE-V3-CONVERSATION-FRESHNESS-ARCHITECTURE.md`, not wired for abandoning in-flight Sol work.
3. **`DelegationCreatedEvent.offset_ms`** — not used for app-level gates (per architecture doc).
4. In-flight **provider** commits intentionally complete; presentation gating partially implemented — needs unified “do not present stale FIND slots” enforcement audit on PSTN.

**Do not** build a second conversation engine — wire existing counters to delegation completion and tool result policy.

---

## 7. TOOL EXECUTION / FORENSICS

### Classification: **C**

### Existing

| Piece | Location |
|-------|----------|
| Python forensics | `voice-runtime-python/.../forensics.py` — `FUNCTION_TOOL_STARTED/COMPLETED`, checkpoints, flush |
| Node ingest | `voice-v3-forensics-bridge.ts`, `call-forensics.ts` |
| Durable package | `forensics-persist.ts` → `VoiceCall.metadata.voiceV3Forensics` |
| Transcript segments | `speechTimestampToSegmentMs`, caller turn timing |
| Delegation telemetry | `gpt_live_delegation_telemetry.py` |
| Legacy tool rows | `livekit-call-telemetry.recordLiveKitBuiltinToolExecution`, `record-call-telemetry-for-python.persistToolExecution`, Telnyx `voiceToolExecution` |

### Gaps

1. **`executeVoiceTool`** (`execute-voice-tool.ts`) logs to console only — **no `voiceToolExecution.create`**.
2. Forensic events often lack **`tool_name`, `bookingAttemptId`, `providerEventId`, offer/slot IDs** on COMPLETE (summaries only).
3. Filler telemetry — worker logs; **not** merged into Node forensic batch (by design: keep passive — extend batch ingest, not sync DB on hot path).

**Preserve:** fail-open, batched, off critical path.

---

## 8. REQUEST_ONLY / QUALIFICATION / URGENCY / CALLBACK

### Classification: **D on `master`** / **B on `cursor/voice-v3-gap-closure-2304` (`d275f9c3`)**

### On `master`

| Feature | Status |
|---------|--------|
| `request_callback` | **A** — tool, persist, requirements, prompts |
| Qualification / urgency wizard → config | **Compiled** (`qualificationFromWizard`, `urgencyEnabled`) — manifest still says “future executor” |
| `REQUEST_ONLY` strategy | Derivable in wizard; **no `submit_appointment_request` on master** |
| Service-specific booking policy | Partial via services compile; no `service-policy.ts` on master |

### On branch `d275f9c3` (not merged to `master`)

- `execute-submit-appointment-request.ts`, `persist-appointment-request.ts`
- `qualification/evaluator`, `urgency` evaluators, `service-policy.ts`, `effective-tool-authorization.ts`
- Booking confirmation SMS hook, publish quality gate
- `scripts/test-voice-v3-qualification-urgency.ts`

### Recommendation

**Cherry-pick / merge gap-closure executors** rather than new qualification engine.

---

## 9. SEND BOOKING LINK

### Classification: **A–B** (~90%)

### Trace (master)

| Stage | Location |
|-------|----------|
| Wizard | `bookingStrategy: SEND_LINK`, `bookingLinkUrl`, consent flags — `appointments-step.tsx` |
| Derive | `booking-strategy.ts` |
| Compile | `bookingStrategyDetailFromWizard` |
| Authorize | `authorize-tool-for-config.ts` — blocked for direct calendar strategies |
| Tool | `send-booking-link-tool.ts` |
| Executor | `booking-link/execute-send-booking-link.ts`, SMS, verbal consent recording |
| Tests | `test-voice-v3-callback-matrix.ts`, `voice-v3-send-link-test-config.ts`, freshness matrix C06 |

### Remaining

- Manifest/runtimeConsumer strings still say “future SEND_LINK executor” in places (documentation drift).
- Ensure published `telephony.outboundSmsE164` always wins over env (executor already documents intent).

**Do not rebuild** executor.

---

## 10. REUSE MATRIX

| Feature | Class | Existing implementation | Reuse unchanged | Thin adapter | Genuine new code | Legacy to avoid |
|---------|-------|---------------------------|-----------------|--------------|------------------|-----------------|
| Booking persistence | C | `markVoiceCallBooked`, `voice/calendar/booking.ts` persist pattern, `product-persist.ts`, notifications | Provider BOOK dispatch | Post-`BOOKING_CONFIRMED` hook mapping `ConfirmedBooking` → DB | Idempotency keys tied to `bookingAttemptId` if missing | `voice/calendar/booking.ts` orchestration loop; V2 Amy |
| Transfer | B–C | compile + authorize + Python warm/waterfall | Python executor, LiveKit APIs | Fix publish/snapshot → non-empty `transfer` | PSTN cert matrix | V2 transfer-only UX |
| Wizard → Live | B–C | compile + prompts + snapshot resolver | GPT-Live prompt shell | Map `instructions.system`, kill prod env fallback | — | Telnyx workflow as runtime authority |
| Website/RAG | D/B | KB API, knowledge-processor, wizard scan; **branch** crawl+RAG | Prisma KB, Telnyx RAG | Merge `website-crawl` + retrieval tool to master | — | New crawler |
| Freshness | C | revision, supersession, tests | Turn manager | Call `markCallerTurnSemanticApplied`; optional cancel | Responses cancel wiring | Keyword intent router |
| Forensics | C | Python batch + metadata persist | Forensics pipeline | Enrich event payload; optional async tool rows | — | Sync DB on tool hot path |
| Qual/urgency/REQUEST_ONLY | D/B | callback on master; engines on branch | `request_callback` | Merge `d275f9c3` engines | — | New rules engine |
| Send link | A–B | Full executor chain | SMS + tool | Manifest doc fixes | — | — |

---

## 11. ACTUAL REMAINING IMPLEMENTATION WORK

(After reuse — **do not re-list** Microsoft FIND/BOOK, idle filler, intake architecture, Google adapter if merged.)

1. **V3 post-book persistence hook** (provider-neutral) — `voice_appointments` + `appointmentBooked` + optional CRM + notifications; **no** change to provider commit.
2. **Merge or port off-master gap-closure** — qualification, urgency, REQUEST_ONLY submit, service policy, booking SMS (`d275f9c3` and related).
3. **Merge or port website knowledge** — `55e48438` / `affb98c5` / `0ad68d4e` (100-page crawl, retrieval, Live RAG) — **not** a new crawler.
4. **Wizard → Live prompt wiring** — published persona/instructions without replacing Live prompt architecture.
5. **Transfer publish alignment** — ensure compiled destinations/routes on real published agents; warm PSTN verification.
6. **Forensics / optional `VoiceToolExecution`** — enrich payloads; async persist from Node tool completion.
7. **Freshness wiring** — semantic apply on delegation completion; stale presentation policies.
8. **(Optional) Business auto-setup import** — `6f0c8044` (15-page wizard import) distinct from 100-page knowledge crawl — product decision.

**Not remaining on master (already done):** cold/warm transfer execution code, send booking link, request callback, Microsoft V3 scheduling core, conversation freshness **library**, forensics **pipeline shell**.

---

## 12. RECOMMENDED IMPLEMENTATION ORDER

1. **Booking persistence hook** — highest product truth gap; reuses `markVoiceCallBooked` / persist patterns; unblocks reporting + Google parity.
2. **Cherry-pick gap-closure qualification / REQUEST_ONLY / service policy** (`d275f9c3`) — wizard fields already compiled.
3. **Cherry-pick knowledge crawl + retrieval** (`55e48438`, `affb98c5`, `0ad68d4e`) — satisfy “website ingestion already built.”
4. **Wizard → Live instruction mapping** — small compile/prompt bridge.
5. **Transfer snapshot fixes + PSTN warm cert** — not a rewrite.
6. **Forensics enrichment + optional tool execution rows** — passive only.
7. **Freshness completion wiring** — tests already exist.

---

## 13. FILES THAT MUST NOT BE TOUCHED (regression risk)

- `src/lib/voice-v3/calendar/microsoft/*` — working Microsoft provider commit.
- `src/lib/voice-v3/calendar/find-dispatch.ts` / slot-generator / offer-set pipeline — except policy gates from merged branch.
- `voice-runtime-python` GPT-Live delegation protocol, `tool_idle_filler.py`, turn detection.
- `src/lib/mctb/**`, certified TeXML MCTB pipeline.
- `src/lib/voice/calendar/booking.ts` — **reference for persist only**; do not route V3 through it.
- LiveKit `WarmTransferTask` executor structure — extend via config, don’t replace with V2 jobs.

---

## 14. GIT HISTORY FINDINGS

Commits **not on `master`** (verify: `git merge-base --is-ancestor <sha> master` → false):

| SHA | Feature | Paths | Safe to extract? |
|-----|---------|-------|------------------|
| **`d275f9c3`** | Qualification, urgency, REQUEST_ONLY, service policy, SMS | `src/lib/voice-v3/policy/*`, `qualification/*`, `appointment-request/*`, `post-call/*` | **Yes** — Node-only, V3 boundary |
| **`55e48438`** | 100-page website crawl job | `src/lib/voice-v3/knowledge/website-crawl/*`, crawl API routes | **Yes** — no V1 voice loop |
| **`affb98c5`** | RAG compile + retrieval resolver | `src/lib/voice-v3/knowledge/resolve-agent-knowledge-retrieval.ts` | **Yes** |
| **`0ad68d4e`** | GPT Live file_search | LiveKit worker + compile hooks | **Yes** — worker config only |
| **`6f0c8044`** | Business auto-setup (Maps + 15-page crawl + review UI) | `src/lib/voice-v3/business-import/*`, Prisma import models | **Yes** — separate from 100-page crawl |
| **`3e16d2b5`** | Gap manifest reconciliation | compile + tools | Merge with above |
| **`f46a3f92`** | Earlier gap foundations | policy/RAG tool stubs | Superseded by later commits |

**Coupled to obsolete architecture:** pre–Voice V3 Telnyx Amy loops, `voice_ai_booking_turn`, old sideband — **do not cherry-pick whole files**; extract business logic only.

**Branches holding work:** `origin/cursor/voice-v3-gap-closure-2304`, `origin/cursor/voice-v3-final-completion-2304`, backups `backup/voice-v3-before-*-rollback`.

---

## Assumption validated

> “Not connected to Voice V3” ≠ “never built.”

Several gap-register lines (warm transfer, send link, transfer compile, website crawl, qualification) are **implemented off `master` or partially on `master`**; remaining work is **merge, thin wiring, and persistence** — not greenfield product builds.
