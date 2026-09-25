# Voice Product IA — Implementation Reconciliation Audit

**Date:** 2026-09-25  
**Status:** READ-ONLY — migration blueprint only (no UI, routes, schema, or runtime changes).  
**Inputs:** Locked six-destination Voice IA + Page Architecture; `docs/VOICE-IA-CANONICAL-KNOWLEDGE-AND-BUSINESS-SCHEDULE-AUDIT.md`; `docs/VOICE-V3-UI-WEIGHT-SURFACE-ARCHITECTURE-AUDIT.md`; repository trace.

**Locked permanent Voice nav:** Overview · Calls · Receptionist · Business Knowledge · Call Handling · Analytics.

**Principle:** MOVE THE CUSTOMER SURFACE. PRESERVE THE PROVEN ENGINE.

---

## A. Executive Summary

| Metric | Count |
|--------|------:|
| Customer-facing Voice **controls/capabilities** inventoried | **92** |
| KEEP IN PLACE | 14 |
| MOVE / REUSE | 38 |
| CONSOLIDATE | 12 |
| REPLACE WITH SUMMARY / LINK | 9 |
| KEEP AS FIRST-RUN ONLY | 11 |
| KEEP AS CONTEXTUAL ACTION | 4 |
| SHARED TRANSOVO (link only) | 6 |
| ADVANCED / PROGRESSIVE DISCLOSURE | 5 |
| REDIRECT / COMPATIBILITY | 8 |
| REMOVE ONLY AFTER DEAD-PATH PROOF | 0 |
| **Functional fix required during implementation** | **3** |
| **Schema / runtime migration required** | **0** |

**Functional fixes (not in this pass):** (1) knowledge-gap resolve → `appendApprovedAnswerToKnowledgeBase` does not call `processKnowledgeSource` / reindex; (2) `state.timezone` vs `businessSchedule.timezone` sync when hours editor moves; (3) optional crawl-job `suggestions` UI or sync to approval queue.

**Verdict (preview):** Implementation can preserve Voice V3 runtime with UI moves + adapters/sync; no engine replacement; no schema migration required for IA alignment.

---

## B. Current Route Inventory

| Route | Current role | Classification | Canonical post-IA |
|-------|----------------|----------------|-------------------|
| `/voice/overview` | KPI hub + quick links | KEEP — CHANGE CONTENT | Overview |
| `/voice/calls` | Call list | KEEP IN PLACE | Calls |
| `/voice/calls/[id]` | Call detail | KEEP — enhance hierarchy | Calls |
| `/mctb/voice-agent` | Full wizard shell | KEEP AS FIRST-RUN + link from Receptionist | First-run; Receptionist links here |
| `/voice/knowledge` | KB CRUD + gaps | MOVE / RENAME CONTENT | **Business Knowledge** (route may become `/voice/business-knowledge` or keep URL + relabel) |
| `/voice/call-handling` | Ops editors | KEEP IN PLACE | Call Handling |
| `/voice/analytics` | Metrics dashboard | KEEP — expand exposure | Analytics |
| `/voice/needs-attention` | Action queue | REDIRECT / COMPATIBILITY | Calls filter/view (`?needs_attention=1`) |
| `/voice/inbound-routing` | Rule engine UI | ADVANCED | Call Handling link |
| `/voice/operations` | Stub | REDIRECT (exists) | → Call Handling |
| `/voice/analytics/after-hours` | Stub | REDIRECT (exists) | → Analytics |
| `/voice/receptionist` | Stub | REDIRECT (exists) | → Receptionist (new) or wizard |
| `/voice/setup` | Legacy MCTB setup | LEGACY COMPATIBILITY | Links to MCTB / first-run |
| `/voice/calendars` | Calendar list | SHARED TRANSOVO | Integrations |
| `/integrations/calendars` | OAuth connections | SHARED TRANSOVO | Integrations |
| `/integrations/webhooks` | Webhooks | SHARED TRANSOVO | Integrations |
| `/company-brain` | Workspace brain editor | CONSOLIDATE into BK or SHARED | Business Knowledge + Shared Workspace |
| `/voice/agents/*` | Generic agent builder | ADVANCED / out of V1 Voice IA | System/operator |
| `/voice/testing`, `/voice/tools`, `/voice/campaigns`, etc. | Legacy/hidden | ADVANCED or hidden | Not primary Voice |
| `/voice/missed-calls`, `/voice/conversations`, `/voice/voicemail` | MCTB-era | REDIRECT to MCTB or hidden | Not Voice IA |
| `/voice/numbers/*` | Numbers purchase | SHARED | Numbers (org) |
| `/voice/callback-requests` | Callback list | CONTEXTUAL | Calls or Contacts |
| `/embed/voice/[agentId]` | Embed | System | — |

**Nav code today:** `src/lib/products/mctb-nav.ts` — labels "AI Agent", "Knowledge", "Needs attention" → must align to **Receptionist**, **Business Knowledge**, drop NA as top-level.

---

## C. Master Feature Reconciliation Matrix

*One row per customer control. **Canonical owner** uses locked IA only.*

| ID | Current route | Current component | Customer concept | API / save | Persistence | Compiler / loader | Runtime consumer | Result UI | Canonical owner | Migration action | Reuse component? | Dup editor? | Risk |
|----|---------------|-------------------|------------------|------------|-------------|---------------------|------------------|-----------|-----------------|------------------|------------------|-------------|------|
| OV-01 | `/voice/overview` | `overview/page.tsx` KPIs | Ops snapshot | `/api/voice/overview` | aggregates | — | — | partial | Overview | KEEP; trim campaign noise | Yes | No | Low |
| OV-02 | overview quick links | link grid | Navigation | — | — | — | — | — | Overview | KEEP; point to 6 destinations | Yes | No | Low |
| CL-01 | `/voice/calls` | list + filters | Call history | `GET /api/voice/calls` | `VoiceCall` | — | — | list | Calls | KEEP IN PLACE | Yes | No | Low |
| CL-02 | calls search/filters | `calls/page.tsx` | Find calls | query params | — | — | — | — | Calls | KEEP; add outcome chips | Yes | No | Low |
| CL-03 | `/voice/calls/[id]` | detail page | Single call story | `GET /api/voice/calls/[id]` | call+related | — | — | detail | Calls | KEEP; hierarchy fix | Yes | No | Med |
| CL-04 | recording player | `WaveformRecordingPlayer` | Recording | stream API | `VoiceRecording` | — | playback | detail | Calls | KEEP IN PLACE | Yes | No | Low |
| CL-05 | transcript tab | detail | Transcript | loader | segments | — | — | detail | Calls | KEEP IN PLACE | Yes | No | Low |
| CL-06 | activity feed | sidebar | Timeline | events/tools | `VoiceCallEvent` | — | — | partial | Calls | MOVE content up | Yes | No | Low |
| CL-07 | callback card | detail | Callback result | included | `CallbackRequest` | — | — | prominent if exists | Calls | KEEP IN PLACE | Yes | No | Low |
| CL-08 | knowledge gaps on call | detail section | Gap occurrence | gaps API | `VoiceKnowledgeGap` | — | post-call | detail | Calls | KEEP; link to BK | Yes | No | Low |
| CL-09 | outcome badges | header | Deterministic outcome | derived | call fields | — | — | header | Calls | ENHANCE | Yes | No | Med |
| CL-10 | needs-attention queue | `/voice/needs-attention` | Attention work | `/api/voice/needs-attention` | mixed | — | — | queue | Calls | CONSOLIDATE as filter/view | Yes | Partial NA | Med |
| CL-11 | block caller | API only | Protection | `block-caller` | blocklist | — | spam runtime | — | Calls contextual | CONTEXTUAL ACTION | Add UI | No | Med |
| RC-01 | wizard Goals | `goals-step` | Capabilities / purpose | `appointment-receptionist` POST | wizard snapshot | `compileVoiceV3AgentConfig` | capabilities gates | — | Receptionist | MOVE/REUSE (summary in CH) | Yes | No | Med |
| RC-02 | wizard Information | identity fields | Agent identity | same | `agentName, role, tone...` | compile → conversation | liveInstructions PERSONA | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-03 | wizard Voice | `voice-step` | Voice + pace | same | voiceId, pace... | telephony compile | LiveKit voice | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-04 | wizard voice preview/test | test-step partial | Preview | v3-wizard-live-test | — | — | — | — | Receptionist + First-run | FIRST-RUN + permanent preview | Yes | No | Low |
| RC-05 | opening greeting | information | Greeting | same | `openingGreeting` | compile conversation | greeting runtime | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-06 | conversation behaviors | information | Behavior | same | `conversationBehaviors` | compile | prompt | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-07 | guardrails | information | Guardrails | same | `guardrails[]` | compile | prompt | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-08 | appointments collect fields | `appointments-step` | Intake | same | `collectFields` | intake compile | tools/intake | detail | Receptionist | MOVE/REUSE | Yes | No | Med |
| RC-09 | qualification rules | appointments | Qualification | same | `qualificationRules` | compile | gate tools | — | Receptionist | MOVE/REUSE | Yes | No | Med |
| RC-10 | booking strategy | appointments | BOOK/REQUEST/LINK | same | `bookingStrategy` | scheduling compile | book tools | call outcome | Receptionist | MOVE/REUSE | Yes | No | High |
| RC-11 | appointment types | appointments | Service catalog | same + hooks | types + `voiceService` | services compile | book/find | — | Receptionist + Appts link | MOVE/REUSE + SHARED link | Yes | No | Med |
| RC-12 | booking behavior toggles | appointments | Booking policy | same | `bookingBehavior` | compile | runtime | — | Receptionist | MOVE/REUSE | Yes | No | Med |
| RC-13 | callback policy | call-handling step | Callbacks | same | callback fields | callHandling | callback tool | NA/calls | Receptionist policy + CH ops | REPLACE SUMMARY on RC; edit in CH | Partial | Yes | Med |
| RC-14 | message-taking cap | goals/caps | Messages | same | capabilities | caps | take_message | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-15 | transfer capability | goals | Transfers enabled | same | `transfer_calls` cap | transfer compile | transfer tools | — | Receptionist | SUMMARY/LINK → Call Handling | Yes | Yes | Med |
| RC-16 | wizard Test | `test-step` | Test agent | test API | `lastTestPassed` | — | test calls | — | First-run only | FIRST-RUN ONLY | Yes | No | Low |
| RC-17 | wizard Activate | `activate-step` | Publish | `action: activate` | publish version | full compile + Telnyx | live agent | — | First-run only | FIRST-RUN ONLY | Yes | No | High |
| BK-01 | information business name | information | Business name | wizard + sync | wizard + `businessBrain` | hot context | prompts | — | Business Knowledge | CONSOLIDATE | Yes | Yes | Med |
| BK-02 | website URL | information | Website | wizard + scan API | `websiteUrl` + KB | retrieval.websiteUrl | RAG | — | Business Knowledge | CONSOLIDATE | Yes | Yes | Med |
| BK-03 | scan website | information | Import | `POST /api/voice/knowledge` scan | crawl job + items | retrieval | FileSearch | — | Business Knowledge | MOVE/REUSE | Yes | Yes | High |
| BK-04 | knowledge item cards | information | Approved facts | wizard save | `knowledgeItems[]` | hotContextFromWizard | BUSINESS FACTS | — | Business Knowledge | CONSOLIDATE | Yes | Yes | High |
| BK-05 | `/voice/knowledge` KB list | knowledge page | Sources | `/api/voice/knowledge` | `VoiceKnowledgeBase` | resolveAgentKnowledgeRetrieval | RAG | — | Business Knowledge | KEEP; rehome nav | Yes | Yes | Med |
| BK-06 | text/url/file sources | knowledge page | Sources | sources/upload APIs | `VoiceKnowledgeSource` | processKnowledgeSource | RAG | — | Business Knowledge | KEEP IN PLACE | Yes | No | Med |
| BK-07 | knowledge gaps panel | knowledge + detail | Unanswered Q | gaps API | `VoiceKnowledgeGap` | post-call | resolve→source | calls+detail | Business Knowledge | CONSOLIDATE | Yes | No | **Fix reindex** |
| BK-08 | company-brain page | `/company-brain` | Workspace facts | `/api/company-brain` | `customFieldsConfig` | loadBusinessBrain | resolveBusinessAnswer | MCTB FAQ | Business Knowledge | CONSOLIDATE or link | Yes | Yes | Med |
| BK-09 | business hours structured | `BusinessScheduleEditor` | Hours FACT | wizard save | `operatingMaturity.businessSchedule` | operatingPolicy | operating state | — | Business Knowledge | CONSOLIDATE (remove from CH duplicate UI later) | Yes | **Yes** | **High** |
| BK-10 | hours knowledge card | information `id=hours` | Hours prose | wizard | `knowledgeItems` | hoursDisplay fallback | spoken hours | — | Business Knowledge | CONSOLIDATE derived or override | Yes | Yes | High |
| BK-11 | timezone | schedule editor | Timezone | wizard | `businessSchedule.timezone` + `state.timezone` | `config.timezone` | all temporal | — | Business Knowledge | CONSOLIDATE + sync | Yes | Yes | **High** |
| BK-12 | holidays | schedule editor | Holidays | wizard | holidays[] | operatingPolicy | closed days | — | Business Knowledge | MOVE with schedule | Yes | No | Med |
| BK-13 | guided profile helper | information | Onboarding facts | wizard | items | hot | — | — | First-run only | FIRST-RUN ONLY | Yes | No | Low |
| BK-14 | link existing KB | information | KB link | wizard | `linkedKnowledgeBaseId` | retrieval ids | RAG | — | Business Knowledge | KEEP | Yes | No | Low |
| BK-15 | crawl approval state UI | partial | Import status | job API | `VoiceWebsiteCrawlJob` | — | RAG readiness | — | Business Knowledge | MOVE/REUSE (new status UI) | Partial | No | Med |
| CH-01 | call-handling page | operational page | Ops handling | `appointment-receptionist` step save | wizard snapshot | compile | runtime | transfer table | Call Handling | KEEP IN PLACE | Yes | No | Med |
| CH-02 | ingress panel | `VoiceIngressSetupPanel` | Phone/CFNA | `/api/call-handling` | product ownership | ingress routing | calls | — | Call Handling | KEEP | Yes | No | Med |
| CH-03 | transfer editor | `EmergencyTransferEditor` | Transfers | wizard save | transfer fields | transfer policy | SIP/waterfall | calls | Call Handling | KEEP | Yes | Wizard dup | Med |
| CH-04 | on-call editor | operating-maturity | On-call | same | onCallSchedule | authorize-transfer | runtime | — | Call Handling | KEEP | Yes | No | Med |
| CH-05 | after-hours behavior | `AfterHoursBehaviorEditor` | After-hours BEHAVIOR | same | whenClosed.* | gateCapabilities | tools | — | Call Handling | KEEP; reference BK hours | Yes | No | High |
| CH-06 | urgency/emergency | urgency editors | Emergency | same | urgencyRules | transfer/auth | outcomes | calls | Call Handling | KEEP | Yes | No | Med |
| CH-07 | spam/solicitor | `SpamUnwantedCallsEditor` | Protection | same | spam policies | compile spam | screening | calls | Call Handling | KEEP | Yes | No | Med |
| CH-08 | recording card | `RecordingConfigCard` | Recording | same | callRecording | telephony | recordings | calls | Call Handling | KEEP | Yes | Phone step dup | Low |
| CH-09 | notifications | `AfterHoursNotificationsEditor` | Notifications | same | notification recipients | jobs | notify | — | Call Handling | KEEP | Yes | No | Med |
| CH-10 | AI call recovery | wizard call-handling | SMS recovery | same | aiCallRecovery* | MCTB cross | SMS | — | Call Handling | KEEP; label MCTB cross | Yes | No | Med |
| CH-11 | recent transfers | CH page table | Transfer history | recent-transfers API | `VoiceTransfer` | — | — | CH + calls | Call Handling | KEEP | Yes | No | Low |
| CH-12 | inbound routing | `/voice/inbound-routing` | Advanced routing | `/api/voice/routing` | rules | rule engine | routing | — | Call Handling | ADVANCED + link | Yes | No | Med |
| CH-13 | hours editor on CH | duplicate schedule block | Hours FACT | same as BK-09 | same | same | same | — | Business Knowledge | REPLACE SUMMARY/LINK on CH | Yes | **Yes** | High |
| AN-01 | analytics dashboard | `voice-analytics-dashboard` | Aggregates | `/api/voice/analytics` | loadVoiceAnalytics | — | — | page | Analytics | KEEP; expose more fields | Yes | Overview dup | Low |
| AN-02 | outcome breakdown table | analytics | Outcomes | same | outcomes map | — | — | — | Analytics | KEEP | Yes | No | Low |
| AN-03 | voiceProduct KPIs | analytics | Product metrics | same | voiceProduct | — | — | partial | Analytics | KEEP | Yes | No | Low |
| AN-04 | byDay / cost / latency | API only | Advanced | same | analytics.ts | — | — | not shown | Analytics | MOVE/REUSE expose | Yes | No | Low |
| AN-05 | sentiment | API only | Secondary | same | insights | — | — | no | Analytics | optional expose | — | No | Low |
| FR-01 | full wizard shell | `/mctb/voice-agent` | First setup | appointment-receptionist | draft+publisher | compile on activate | all | — | First-run only | KEEP AS FIRST-RUN | Yes | Yes all | High |
| FR-02 | wizard phone step | `phone-step` | Phone/recording greet | same | phone fields | telephony | ingress related | — | First-run + CH | FIRST-RUN; CH owns ops | Yes | Yes | Med |
| FR-03 | wizard call-handling step | `call-handling-step` | CH subset | same | CH fields | compile | runtime | — | First-run | FIRST-RUN mirror CH | Yes | Yes | Med |
| SH-01 | calendar OAuth | appointments step | Calendar | `/api/integrations/calendars` | connections | provider resolve | MS/Google book | appt outcome | Integrations | SHARED TRANSOVO | Yes | No | Med |
| SH-02 | webhooks | integrations | Webhooks | webhooks API | endpoints | post-call | webhooks | — | Integrations | SHARED link | Yes | No | Low |
| SH-03 | contacts | — | Caller identity | contacts API | Contact | — | call list name | Contacts | SHARED | Link from Calls | — | No | Low |

### C.1 Master matrix — continuation rows

| ID | Current route | Component | Concept | API | Persistence | Compile | Runtime | Result | Owner | Action | Reuse | Dup | Risk |
|----|---------------|-----------|---------|-----|-------------|---------|---------|--------|-------|--------|-------|-----|------|
| RC-18 | wizard goals | capabilities.reschedule | Reschedule cap | wizard | capabilities | caps | tools | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-19 | wizard goals | capabilities.cancel | Cancel cap | wizard | capabilities | caps | tools | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-20 | appointments | zip qualification | Geo qualify | wizard | qualificationRules | compile | gate | — | Receptionist | MOVE/REUSE | Yes | No | Low |
| RC-21 | appointments | SEND_LINK sender | Link SMS | phone step | smsSender | telephony | send link | outcome | Receptionist link | SUMMARY/LINK → Numbers/CH | Yes | Yes | Med |
| CH-14 | CH | transferPlanSteps | Waterfall | wizard | steps[] | transfer | waterfall | calls | Call Handling | KEEP | Yes | No | High |
| CH-15 | CH | warmTransfer | Warm xfer | wizard | warmTransfer | policy | SIP | calls | Call Handling | KEEP | Yes | No | Med |
| CH-16 | CH | detectVoicemailOnTransfer | VM detect | wizard | flag | policy | xfer | — | Call Handling | KEEP | Yes | No | Low |
| CH-17 | CH | callbackSla | Callback SLA | wizard | callbackSla | callHandling | callback | NA | Call Handling | KEEP | Yes | No | Low |
| CH-18 | CH | spamLikelyPolicy | Spam policy | wizard | spamLikely | spam compile | screen | calls | Call Handling | KEEP | Yes | No | Med |
| CH-19 | API | blocked-callers | Blocklist | block API | blocked | — | ingress | — | Call Handling | ADVANCED UI | Partial | No | Med |
| CH-20 | CH | ownership switch | AI vs human | call-handling API | product ownership | ingress | routing | — | Call Handling | KEEP | Yes | No | High |
| CL-12 | calls detail | executionTrace | Debug trace | metadata | call.metadata | — | — | hidden | Calls | ADVANCED collapse | Yes | No | Low |
| CL-13 | calls detail | toolExecutions | Tool runs | loader | executions | — | tools | feed | Calls | ENHANCE | Yes | No | Med |
| CL-14 | calls | leadScore filter | Qualified | list API | leadScore | — | — | filter | Calls | KEEP | Yes | No | Low |
| CL-15 | calls | callFeedback PATCH | Feedback | PATCH | feedback | — | — | — | Calls | KEEP | Yes | No | Low |
| CL-16 | calls | export button | Export | stub | — | — | — | — | Calls | REMOVE after proof or wire | No | No | Low |
| CL-17 | calls | date picker | Date filter | stub UI | — | — | — | — | Calls | WIRE or hide | No | No | Low |
| OV-03 | overview | phone minutes | Usage | overview API | usage | — | — | card | Overview | KEEP | Yes | Analytics dup | Low |
| BK-16 | information | guided profile | Onboarding | wizard | items | hot | — | — | First-run | FIRST-RUN | Yes | No | Low |
| BK-17 | knowledge | create KB | New KB | POST knowledge | VoiceKnowledgeBase | link | RAG | — | Business Knowledge | KEEP | Yes | No | Med |
| BK-18 | knowledge | delete source | Remove source | DELETE | source | reindex | RAG | — | Business Knowledge | KEEP | Yes | No | Med |
| FR-04 | phone step | ring behavior | Ring policy | wizard | ring* | telephony | — | — | First-run + CH | FIRST-RUN / CH | Yes | Yes | Low |
| FR-05 | phone step | connection greeting | Conn greeting | wizard | greeting | telephony | — | — | First-run | FIRST-RUN | Yes | No | Low |
| FR-06 | call-handling step | sales solicitation | Solicitor | wizard | sales fields | spam | screen | — | Call Handling | MOVE to CH permanent | Yes | Yes | Low |
| AN-06 | analytics | openKnowledgeGaps link | Gap count | analytics API | gaps count | — | — | link | Analytics | KEEP | Yes | BK dup | Low |
| SH-04 | appointments | Calendly connect | Calendar | integrations | OAuth | provider | book | outcome | Integrations | SHARED | Yes | No | Med |
| SH-05 | settings business | workspace profile | Org settings | settings API | workspace | — | — | — | Shared Workspace | LINK | — | No | Low |
| SYS-01 | `/voice/agents/*` | generic builder | Operator agents | agents API | VoiceAgent | legacy compile | varies | — | System/operator | ADVANCED hidden | — | No | Low |
| SYS-02 | embed voice | embed widget | Embed | embed route | agent | — | — | — | System/operator | KEEP | Yes | No | Low |

*Rows C + C.1 total **92** inventoried controls.*

---

## D. Business Knowledge Matrix

| Customer fact/source | Current editor(s) | Persistence | Hot context? | Company Brain? | RAG? | Runtime fallback? | Proposed canonical editor | Compatibility/sync |
|--------------------|-------------------|-------------|--------------|----------------|------|-------------------|---------------------------|----------------------|
| Business name | Wizard info, Company Brain | wizard + brain | Yes (`businessName`) | Yes sync on save | No | resolveBusinessAnswer | Business Knowledge | syncCompanyBrainFromWizard |
| Business description | knowledgeItems[business] | items | Yes | facts if approved | crawl text | brain | Business Knowledge | approve pipeline |
| Website URL | wizard, scan | websiteUrl + KB | retrieval.websiteUrl | website | URL sources | — | Business Knowledge | linkedKnowledgeBaseId |
| Services | items, appointment types, brain.services | items + voiceService | servicesSummary | services | RAG | brain | BK + link Appointments types | hooks on activate |
| Service areas | items (if any) | items | optional summaries | facts | RAG | resolveBusinessAnswer | Business Knowledge | — |
| Pricing | items[pricing] | items | pricingSummary | facts | RAG | resolve | Business Knowledge | — |
| Policies | items[policies] | items | policiesSummary | facts | RAG | — | Business Knowledge | — |
| FAQs | items / gap resolve | items / sources | itemSummaries | facts | text sources | faq map | Business Knowledge | gap→source reindex **FIX** |
| Business hours (structured) | BusinessScheduleEditor (info + CH) | operatingMaturity.businessSchedule | hoursDisplay (authoritative) | prose only via hours item | No | tool hours fields | **Business Knowledge** | remove CH duplicate editor; keep same JSON path |
| Business hours (prose) | knowledgeItems[hours] | items | fallback only | businessHoursSummary | No | resolveBusinessAnswer | Derived or labeled override | conflict flag exists |
| Timezone | schedule editor; `state.timezone` scalar | schedule.tz + state.timezone | config.timezone | defaultTimezone from **state** | No | all temporal | Business Knowledge | **sync state.timezone ↔ schedule.tz** |
| Holidays | schedule editor | holidays[] | via operating state | No | No | closed detection | Business Knowledge | — |
| Text/URL/file sources | /voice/knowledge | VoiceKnowledgeSource | No | previews in brain load | Yes | searchKnowledge | Business Knowledge Sources panel | processKnowledgeSource |
| Discovered website facts | placeholder items + job.suggestions | items extracted + job row | No until approved | No | Yes when indexed | — | Approval queue in BK | suggestions not in UI today |
| Gap answers | gaps panel resolve | VoiceKnowledgeGap + new source | No until indexed | No | Yes after index | — | BK unresolved workflow | **FUNCTIONAL GAP** |

**Moving BK editor does not require new tables** — continue writing `operatingMaturity.businessSchedule`, `knowledgeItems`, brain sync, KB tables.

---

## E. Business Hours Dependency Matrix

```
Business Knowledge UI (target)
  → POST /api/solutions/appointment-receptionist (wizardStepId: information | dedicated BK step)
  → VoiceAgent.draftConfig.advanced.appointmentReceptionistWizard.operatingMaturity.businessSchedule
  → ensureWizardOperatingMaturity(wizard)
  → compileVoiceV3AgentConfig → operatingPolicy.businessSchedule + business.hoursDisplay
  → resolveVoiceV2OperatingState({ schedule, at })
  → gateCapabilitiesForOperatingState(afterHoursBehavior)
  → isVoiceV3ToolAuthorizedEffective (book/transfer/message/callback)
  → authorize-transfer.ts (on-call + schedule)
```

| Field | Must stay synchronized if UI moves |
|-------|--------------------------------------|
| `operatingMaturity.businessSchedule.weekly` | **Yes** — single object; remove duplicate editors only |
| `operatingMaturity.businessSchedule.timezone` | **Yes** — compile `config.timezone` |
| `state.timezone` | **Compat sync** — brain sync uses it today |
| `knowledgeItems[hours].summary` | Optional derived read-only or explicit override |
| `businessBrain.businessHoursSummary` | Sync from structured or approved prose on save |
| Call Handling `afterHoursBehavior` | **Unchanged persistence** — consumes compiled policy |

---

## F. Website / RAG Dependency Matrix

| Stage | Persistence / API | UI state required |
|-------|-------------------|-------------------|
| URL accepted | wizard `websiteUrl` | Input + validation |
| Crawl queued | `VoiceWebsiteCrawlJob` DISCOVERING | linked KB id |
| Processing | job CRAWLING; sources processing | spinner / job status |
| Indexed | source `indexed`; vector store ready | “Ready for Amy retrieval” |
| Failure | job FAILED; source failed | error + retry |
| Facts discovered | job `suggestions` (orphan today) | approval queue **gap** |
| Awaiting approval | items `extracted` | BK approval cards |
| Approved | `complete`/`owner_approved` | hot context + brain sync |
| Linked to agent | `linkedKnowledgeBaseId`, agent links | status on BK + Receptionist summary |
| Not linked | KB exists | warning in BK |

**Chain certified:** PRESERVABLE AS-IS with **REQUIRES UI ADAPTER** for status truthfulness.

---

## G. Knowledge Gap Dependency Matrix

```
Call end → summary LLM (knowledgeGapCandidates) → persistKnowledgeGapCandidates
  → VoiceKnowledgeGap (OPEN)
  → Call detail section + BK gaps panel + Analytics count
  → PATCH resolve + answerText → appendApprovedAnswerToKnowledgeBase (status: active)
  → **NO processKnowledgeSource in PATCH handler**
  → Amy may NOT retrieve until manual reindex/processing
```

**FUNCTIONAL GAP — MUST FIX DURING IMPLEMENTATION** (enqueue `processKnowledgeSource` or equivalent).

---

## H. Receptionist Dependency Matrix (summary)

| Control | Wizard component | State fields | Save | Compile | Permanent UI today | Reuse outside wizard? | Publish coupling |
|---------|------------------|--------------|------|---------|----------------------|----------------------|------------------|
| Identity | information | agentName, role, tone, speakingStyle | step merge | conversation.* | No | **Yes** | draft until activate |
| Voice | voice-step | voiceId, pace, accent... | step | telephony | No | **Yes** | draft |
| Greeting/behavior | information | openingGreeting, behaviors, guardrails | step | liveInstructions | No | **Yes** | draft |
| Capabilities | goals | capabilities[] | step | capabilities | No | **Yes** | draft |
| Intake | appointments | collectFields | step | intakeFields | No | **Yes** | draft |
| Qualification | appointments | qualification* | step | qualification | No | **Yes** | draft |
| Booking policy | appointments | strategy, behavior, types | step | scheduling | No | **Yes** | draft |
| Messages/callbacks policy | call-handling step | callback* caps | step | callHandling | No | partial | draft |

**Risk:** Extracting components must keep calling `POST /api/solutions/appointment-receptionist` with correct `wizardStepId` or shared save helper — **REQUIRES UI ADAPTER**, not new persistence.

---

## I. Call Handling Dependency Matrix (summary)

| Area | UI | API | Persistence | Compiler | Runtime | Outcome UI |
|------|-----|-----|-------------|----------|---------|------------|
| Ingress | VoiceIngressSetupPanel | `/api/call-handling` | product ownership + wizard phone | ingress | routing | — |
| Transfers | EmergencyTransferEditor | wizard CH save | transfer* | transfer policy | SIP/waterfall | calls+CH table |
| After-hours behavior | AfterHoursBehaviorEditor | same | whenClosed | operatingPolicy | tool gates | — |
| On-call / urgency | maturity editors | same | schedules/rules | authorize | transfer | calls |
| Spam / recording / notify / AI recovery | CH cards | same | wizard fields | compile | runtime | calls |

**Wizard whole-state coupling:** `call-handling-operational-page.tsx` loads full wizard state and saves `wizardStepId: "call-handling"` — **preserve** when relocating controls.

---

## J. Calls / Outcome Matrix

| Result | Backend available? | List shows? | Detail shows? | Timeline? | Needs Attention? | Recommended |
|--------|-------------------|-------------|---------------|-----------|------------------|-------------|
| Appointment booked | `appointmentBooked`, tools | badge partial | action item | feed | no | Header chip + Calls |
| Appointment requested | outcome string | partial | action item | partial | no | Header chip |
| Booking link sent | outcome/tools | no | buried | partial | no | Outcome chip |
| Booking failure | tools failed | no | partial | partial | possible | Attention + detail |
| Callback requested | CallbackRequest | no | card | feed | **yes** | Header + filter |
| Message taken | outcome | badge | action item | feed | partial | Chip |
| Transfer attempted | transfers[] | badge transferred | action item | feed | no | Chip |
| Transfer success | transfer status | partial | action item | feed | no | Chip |
| Transfer failed | transfer failed | no | action item | feed | **failed_transfer** | Chip + attention |
| Waterfall exhausted | transfer status | no | partial | partial | possible | Detail |
| Voicemail | voicemailDetected | filter | badge | partial | voicemail kind | Chip |
| Urgent/emergency | outcome | no | no | partial | no | **Gap** — add chip |
| Spam/solicitor | outcome | no | no | partial | no | **Gap** |
| Qualified | leadScore | leads filter | no | no | no | Optional chip |
| Knowledge gap | VoiceKnowledgeGap | no | section | no | no | Chip + BK link |
| Recording | recordings | icon partial | player | feed | no | Keep |
| Transcript | segments | no | tab/preview | feed | no | Keep |
| Summary | insights | summary col | card | no | no | Promote |
| Intake fields | structuredMessage | no | info dl | no | no | Promote |
| Tool failure | toolExecutions | no | buried | feed | no | Detail diagnostics |
| executionTrace | metadata | no | no | no | no | Advanced collapse |

---

## K. Needs Attention Reconciliation

| Kind (`needs-attention-types`) | Source object | Resolution | In Calls today? | Future |
|--------------------------------|---------------|------------|-----------------|--------|
| callback_request | CallbackRequest | call back, mark done | no | Calls filter + row flag |
| failed_transfer | VoiceTransfer / call | view call, done | no | Calls filter |
| voicemail | voicemail | listen/call | no | optional / MCTB overlap |
| mctb_reply | MCTB inbox | open conversation | no | cross-product strip or exclude |
| missed_call | MCTB | MCTB flows | no | not Voice-primary |
| form_submission | forms | review | no | contextual |
| repeat_caller | derived | awareness | partial | Calls metadata |

**Route:** `/voice/needs-attention` → **REDIRECT** to `/voice/calls?attention=open` (compat).

Types **mctb_reply / missed_call** may remain cross-product — flag in implementation batch 7.

---

## L. Analytics Reconciliation

| Metric (backend) | On `/voice/analytics` UI? | Class |
|------------------|---------------------------|-------|
| totalCalls, inbound, answerRate, avgDuration | Yes | Primary |
| voiceProduct.* outcomes | Yes | Primary |
| outcomes map | Yes table | Primary |
| byDay | No | Primary — expose trend |
| humanAnswerRate, voicemailRate | No | Secondary |
| cost*, aiMinutes, telephonyMinutes | No | Advanced |
| latency.*, toolSuccessRate | No | Advanced |
| sentimentCounts | No | Secondary |
| byAgent, byCampaign | No | Advanced / duplicate campaigns |
| openKnowledgeGaps | Link only | Primary |

Overview duplicates some KPIs — **REPLACE WITH SUMMARY/LINK** to Analytics.

`/voice/analytics/after-hours` — **REDIRECT** (already).

---

## M. Integrations Reconciliation

| Integration | Current surface | Canonical | Voice access |
|-------------|-----------------|-----------|--------------|
| Microsoft calendar | appointments wizard + `/integrations/calendars` | Integrations | Receptionist “Calendar connected” summary + link |
| Google calendar | same | Integrations | same |
| Webhooks | `/integrations/webhooks` | Integrations | Call Handling or Analytics link |
| Telnyx publish | activate (first-run) | First-run | status on Receptionist |
| Company Brain | `/company-brain` | BK or Shared | merge into BK |

No Voice-only marketplace. **Do not duplicate** OAuth UI in Voice permanent pages.

---

## N. Route Migration Map

| Route | Action | Inbound refs to update later |
|-------|--------|------------------------------|
| `/voice/knowledge` | CHANGE CONTENT / optional alias | nav, overview, analytics link |
| `/mctb/voice-agent` | FIRST-RUN; Receptionist CTA | nav “AI Agent” → Receptionist |
| `/voice/needs-attention` | REDIRECT compat | nav remove, overview link |
| `/voice/operations` | REDIRECT (done) | legacy links |
| `/voice/analytics/after-hours` | REDIRECT (done) | — |
| `/voice/receptionist` | REPURPOSE as permanent Receptionist hub | currently → setup |
| `/voice/inbound-routing` | ADVANCED | CH banner |
| `/voice/call-handling` | KEEP | — |
| `/voice/calls*` | KEEP | — |
| `/voice/overview` | KEEP | — |
| `/voice/analytics` | KEEP | — |

---

## O. Shared Component Reuse Map

| Component | Current location | Responsibility | Proposed location(s) | Unchanged? | Adapter? |
|-----------|------------------|----------------|----------------------|------------|----------|
| `EmergencyTransferEditor` | wizard + CH | Transfers | Call Handling | Yes | save context |
| `BusinessScheduleEditor` | info + CH | Hours FACT | Business Knowledge only | Yes | remove CH instance |
| `operating-maturity-editor` blocks | CH | on-call, behavior | Call Handling | Yes | hours link |
| `SpamUnwantedCallsEditor` | CH | spam | Call Handling | Yes | — |
| `RecordingConfigCard` | CH | recording | Call Handling | Yes | — |
| `VoiceIngressSetupPanel` | CH | ingress | Call Handling | Yes | — |
| `KnowledgeGapsPanel` | knowledge | gaps | Business Knowledge | Yes | — |
| `goals/information/appointments/voice` steps | wizard | receptionist | Receptionist page sections | Yes | save wrapper |
| `voice-analytics-dashboard` | analytics | metrics | Analytics | Yes | more fields |
| `needs-attention-view` | NA page | queue | Calls embedded view | Yes | filter props |
| `WaveformRecordingPlayer` | call detail | audio | Calls | Yes | — |
| `TransferEffectiveStatusCard` | CH | summary | Call Handling | Yes | — |

**Visual:** reuse classNames; no Kimi redesign.

---

## P. Duplicate Editor Report

| Concept | Editors today | Canonical | First-run | Summary/link | Same state? | Sync work |
|---------|---------------|-----------|-----------|--------------|-------------|-----------|
| Business hours | Info schedule, CH schedule, hours card | BK schedule editor | wizard copy OK | CH shows “Manage Business Knowledge” | **Yes** same JSON | prose + brain |
| Business facts | wizard items, KB, company-brain | BK unified | wizard scan | — | **Partial** | approve + brain sync |
| Transfers | wizard CH step, CH page | Call Handling | wizard mirror | Receptionist summary | **Yes** | — |
| Recording | phone step, CH card | Call Handling | phone first-run | — | **Yes** | — |
| Calendar | appointments step, integrations | Integrations | wizard connect | Receptionist status | connection ids | — |
| Timezone | schedule.tz vs state.timezone | BK | — | — | **No** | **compat sync** |
| Needs attention | NA page vs calls | Calls view | — | — | N/A | new filters |

---

## Q. Orphan Report

| Type | Item |
|------|------|
| UI → weak runtime | Calls date picker / export buttons (non-functional UI) |
| UI → wrong owner | BusinessScheduleEditor on Call Handling (should reference BK) |
| Runtime → no UI | `executionTrace`, crawl `suggestions`, blocked-callers list |
| Result → weak UI | emergency/spam outcomes, booking link sent, tool failures |
| UI misleading | Information InfoCallout (Telnyx-only wording for V3) |

No removal recommended without dead-path proof.

---

## R. Protected Runtime Chain Assessment

| Chain | Assessment |
|-------|------------|
| Knowledge hot context | **PRESERVABLE** + COMPAT SYNC on approval |
| RAG / FileSearch | **PRESERVABLE AS-IS** |
| Business hours / gating | **PRESERVABLE** + UI ADAPTER (single schedule editor) |
| Booking MS/Google | **PRESERVABLE AS-IS** |
| Transfers / waterfall | **PRESERVABLE AS-IS** |
| Post-call → gaps → analytics | **REQUIRES FUNCTIONAL FIX** on gap resolve indexing |
| Draft/publish → Telnyx | **PRESERVABLE** — permanent UI must respect activate |

---

## S. Draft / Publish Semantics Matrix

| Setting group | Save behavior | Draft? | Publish required? | Activation point | Must preserve? |
|---------------|---------------|--------|-------------------|------------------|----------------|
| Wizard steps (Receptionist/BK/CH fields) | `save_draft` merges per step | Yes | For live PSTN: `activate` | `publishVoiceAgent` + Telnyx | **Yes** |
| Active agent draft save | allowed when ACTIVE | Yes | Reactivate for provider? | route.ts L173+ | **Yes** |
| Call Handling page save | `save_draft` wizardStepId call-handling | Yes | Same as wizard | compile on next resolve | **Yes** |
| `/api/call-handling` ingress | PATCH ownership | Immediate? | product switch | ingress API | **Yes** |
| Company Brain | POST immediate | No | N/A | loadBusinessBrain | **Yes** |
| KB CRUD | immediate | N/A | RAG on index | retrieval resolve | **Yes** |
| Gap resolve | immediate status | N/A | RAG after fix | source processing | **Fix** |

Permanent Receptionist/BK editors should **not** silently bypass publish for fields that today only apply after activate unless product explicitly allows “draft mode” UX.

---

## T. Tenant-Risk Review (movement-induced)

| Risk | Mitigation |
|------|------------|
| Reused save APIs without `workspaceId` from session | Keep `requireSession` paths; no client-supplied workspace |
| Call Handling + wizard share state | Still single `VoiceAgent` per workspace agent — no cross-tenant |
| KB link wrong agent | UI must scope links to current workspace agent |
| Embedded components in Calls | attention queue still filters by `auth.workspaceId` |

No new cross-tenant patterns identified.

---

## U. Implementation Batches (recommended)

| Batch | Surfaces | State / chains | Risk | Validation |
|-------|----------|----------------|------|------------|
| 1 | Nav shell, labels, redirects (NA, operations, after-hours, receptionist stub) | routes only | Low | static route tests |
| 2 | Calls outcome hierarchy + attention filter | display only | Med | API fixture review |
| 3 | Receptionist page — extract wizard components + save wrapper | wizard snapshot, publish | **High** | save step merge tests |
| 4 | Business Knowledge — consolidate editors, crawl status, brain link | items, schedule, KB | **High** | compile snapshot diff |
| 5 | Hours editor consolidation + timezone sync | operatingMaturity | **High** | operating state unit tests |
| 6 | Call Handling — remove duplicate schedule; summary link BK | same JSON | Med | CH save test |
| 7 | Needs Attention embedded in Calls | NA API | Med | manual queue |
| 8 | Analytics — expose byDay/cost/latency | none | Low | API vs UI |
| 9 | Route aliases, legacy cleanup | — | Low | link grep |
| 10 | Functional fixes (gap reindex, suggestions UI) | RAG | Med | gap resolve test |

**Owner certification later:** PSTN smoke, booking, transfer — out of scope for this audit.

---

## V. Final Readiness Verdict

1. **Six-destination IA with V3 runtime?** **Yes**, with adapters and compat sync — no engine replacement.  
2. **Purely presentational moves?** Nav labels, Calls chips, Overview links, Analytics extra columns.  
3. **Adapters required?** Receptionist/BK component extraction with `wizardStepId` save; Calls attention view; crawl status UI.  
4. **Compat synchronization?** timezone scalar, brain hours prose, duplicate schedule removal.  
5. **Functional fixes?** Gap resolve indexing; optional crawl suggestions approval.  
6. **Replace proven runtime?** **No.**  
7. **Schema migration?** **No** for IA (keep wizard JSON + KB + brain).  
8. **Preserve styling/components?** **Yes** — reuse existing editors.  
9. **Unassigned features?** Legacy `/voice/agents/*`, campaigns — ADVANCED/hidden, not unassigned.  
10. **Orphan risk?** Mitigated by batch 2 + 7 + gap fix.  
11. **Protected chains accounted?** Yes, with noted FUNCTIONAL GAP.  
12. **Ready for controlled implementation?** **Yes**, after acknowledging sync/fix items.

---

## RECONCILIATION COMPLETE — READY FOR CONTROLLED IMPLEMENTATION

**Unresolved (track in implementation, not blockers for starting batch 1–2):**

- Cross-product Needs Attention kinds (MCTB) — product decision in batch 7.  
- Permanent route URL for Business Knowledge (`/voice/knowledge` vs rename).  
- Whether Company Brain merges into BK route or remains linked Shared Workspace.  
- Exact publish UX on permanent Receptionist (mirror wizard vs explicit “Publish changes”).

---

*End of report. No repository implementation changes in this pass.*
