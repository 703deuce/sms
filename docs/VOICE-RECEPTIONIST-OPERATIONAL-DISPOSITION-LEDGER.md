# Receptionist wizard — operational disposition ledger

**Branch:** `cursor/receptionist-wizard-sidebar-nav-2304` (draft PR #546)  
**Pass:** Inline unique operational functionality into Steps 3 and 5 (no tabs / no `?view=`).  
**Source inventory:** `docs/VOICE-AGENT-WIZARD-KNOWLEDGE-CALL-HANDLING-OVERLAP.md`

---

## `/voice/knowledge` — every customer-facing feature

| Feature | Disposition | Notes |
|---------|-------------|--------|
| Knowledge gaps inbox (open list) | **ADDED TO INFORMATION** | `VoiceKnowledgeGapsPanel` + `/api/voice/knowledge-gaps` inline below Step 3 editor |
| Dismiss gap | **ADDED TO INFORMATION** | Same PATCH API as standalone |
| Resolve gap (with answer) | **ADDED TO INFORMATION** | Same PATCH API as standalone |
| Core business name / description / services / website fields | **ALREADY IN WIZARD** | Step 3 guided profile + knowledge items |
| Business hours display (read-only rows) | **ALREADY IN WIZARD** | `BusinessScheduleEditor` + hours in knowledge items (richer than standalone display) |
| Edit hours navigation | **INTENTIONALLY NOT COPIED** | Standalone button replaced: routes to `?step=information` (not MCTB `/voice/setup`); hours edited inline on Step 3 |
| FAQ list + add via prompt | **ALREADY IN WIZARD** | Step 3 knowledge items / guided profile |
| Sources list + per-source status | **ADDED TO INFORMATION** | `VoiceKnowledgeSourcesPanel` + `/api/voice/knowledge/:id` |
| Crawl/index summary, last crawl | **ADDED TO INFORMATION** | `/api/voice/knowledge/crawl/latest` via `useVoiceKnowledgeOperations` |
| Recrawl website | **ADDED TO INFORMATION** | POST `/api/voice/knowledge/crawl` (operational action on Sources panel) |
| Document upload (KB) | **ALREADY IN WIZARD** + **ADDED TO INFORMATION** | Step 3 upload flow remains canonical; Sources panel exposes upload for source health parity |
| Save / persist knowledge | **ALREADY IN WIZARD** | Wizard Continue/Save; standalone page keeps its own Save for route compatibility |
| Timezone field on standalone form | **ALREADY IN WIZARD** | `BusinessScheduleEditor` / operating maturity on Step 3 |
| `knowledgeSource` mode cards | **ALREADY IN WIZARD** | Not on standalone page |
| `knowledgeBaseEnabled` RAG toggle | **ALREADY IN WIZARD** | Not on standalone page |
| Connect existing KB picker | **ALREADY IN WIZARD** | Step 3 `ConnectExistingKnowledge` |

---

## `/voice/call-handling` — every customer-facing feature

| Feature | Disposition | Notes |
|---------|-------------|--------|
| Current behavior summary (during / after hours) | **ALREADY IN WIZARD STEP 5** | `AfterHoursBehaviorEditor` + side panel preview |
| Transfer destinations list + add target | **ALREADY IN WIZARD STEP 5** | `EmergencyTransferEditor` (richer than standalone list) |
| Ring team first | **ALREADY IN WIZARD STEP 5** | `AfterHoursBehaviorEditor` / `whenClosed.allowOfficeTransfer` |
| AI after hours | **ALREADY IN WIZARD STEP 5** | `whenClosed.allowOnCallEscalation` |
| Holiday schedule toggle | **ALREADY IN WIZARD STEP 3** | `BusinessScheduleEditor` holidays (canonical; not duplicated on Step 5) |
| On-call schedule | **ALREADY IN WIZARD STEP 5** | `OnCallScheduleEditor` |
| Emergency keywords display / add UI | **ALREADY IN WIZARD STEP 5** | `transferTriggers` in `EmergencyTransferEditor` |
| Warm transfer / whisper | **ALREADY IN WIZARD STEP 5** | Transfer editor + `warmTransfer` |
| Text summary / after-hours notifications | **ALREADY IN WIZARD STEP 5** | `AfterHoursNotificationsEditor` |
| Block spam (`spamLikelyPolicy`) | **ADDED TO STEP 5** | Was standalone + legacy ops page only; **not** in Opus Step 5 until `SpamUnwantedCallsEditor` mounted in `call-handling-step.tsx` (radio: BLOCK / SCREEN / ALLOW → `patch({ spamLikelyPolicy })`) |
| Sales & solicitors (`solicitorPolicy`, `salesSolicitationEnabled`, `salesSolicitationAction`) | **ADDED TO STEP 5** | Same editor section (radio: DECLINE / TAKE_MESSAGE / ALLOW); MCTB-only toggle in Step 5 was **not** Opus-visible |
| Call recording | **ALREADY IN WIZARD STEP 2** | `phone-step.tsx` `callRecording` — **not** duplicated on Step 5 |
| Recording retention copy | **INTENTIONALLY NOT COPIED** | Informational only on standalone; no separate config |
| Recent transfers table | **ADDED TO STEP 5** | `VoiceCallHandlingRecentTransfersPanel` + `/api/voice/call-handling/recent-transfers` |
| Routing / ingress diagnostics | **ADDED TO STEP 5** | `VoiceCallHandlingRoutingPanel` → `OpusCallRoutingIngressPanel` |
| Save draft | **ALREADY IN WIZARD** | Wizard save semantics; standalone route retains Save |
| Booking behavior toggles | **ALREADY IN WIZARD STEP 5** | Not on standalone as full set |
| AI Call Recovery | **ALREADY IN WIZARD STEP 5** | Not on standalone |
| Callback required fields | **ALREADY IN WIZARD STEP 5** | Not on standalone |
| Full urgency rules editor | **ALREADY IN WIZARD STEP 5** | MCTB presentation |

---

## Architecture confirmations

- No `?view=` secondary navigation; no tabs/modals/drawers for ops split.
- `/voice/knowledge` and `/voice/call-handling` routes preserved.
- Eight-step sidebar unchanged; `AppointmentReceptionistWizardState` unchanged for ops data.
