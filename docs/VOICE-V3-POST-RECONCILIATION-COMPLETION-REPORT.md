# Voice V3 — post-reconciliation completion report (final pre-merge closure)

**STOP BEFORE MERGE** — awaiting explicit approval.

## A. Starting state

| Item | Value |
|------|--------|
| `origin/master` baseline | `3b3945b3004b7142b95dff6c3a3c3c8b3c91e5ff` |
| Branch | `cursor/voice-v3-post-reconciliation-completion-2304` |
| Historical branches merged | **none** |

## B. Final closure pass (this iteration)

### 1. Post-call webhooks — **connected**

| | Detail |
|---|--------|
| **Attachment** | `runVoiceV3CallHistoryPostProcess` → fire-and-forget IIFE → `runVoiceV3PostCallSideEffects` |
| **Implementation** | `emit-post-call-webhooks.ts` reuses `webhooks/delivery.ts` (`queueVoiceWebhookDelivery`, per-hook `eventId` upsert) |
| **Semantics** | Async; failures logged; does not block transcript/summary/recording; idempotent via `metadata.voiceV3PostCall.webhooksEmittedAt` |
| **Did not restore** | `processVoiceV3CompletedCall` as primary pipeline |

### 2. Knowledge-gap persistence — **connected**

| | Detail |
|---|--------|
| **Source of candidates** | LLM call-history summary JSON (`knowledgeGapCandidates`) stored on `voiceConversationInsight.customFields.voiceV3KnowledgeGapCandidates` — transcript + deterministic facts only; no live-call LLM |
| **Attachment** | Same `runVoiceV3PostCallSideEffects`; `persistKnowledgeGapCandidates` → `voiceKnowledgeGap` |
| **Semantics** | Fail-open; idempotent via `metadata.voiceV3PostCall.knowledgeGapsPersistedAt`; deterministic-only summaries produce no gaps |

### 3. Callback SLA — **truthfulness + wiring**

| Question | Answer |
|----------|--------|
| Real due timestamp from wizard? | **Yes** — `computeCallbackDeadline` + `callbackSlaMetadataPatch` on persist |
| Persisted? | **Yes** — `callbackRequest.metadata.voiceV2CallbackSla.promisedDeadline` |
| Overdue job runs? | **Yes** — `voice_v2_callback_sla_overdue_scan` via `job-handlers.ts` |
| What triggers it? | Scheduled job enqueue (minute cadence) |
| On overdue? | Lifecycle → `OVERDUE`, `overdueNotifiedAt` set, in-app `notifyWorkspace` → `/voice/callback-requests` |
| Needs Attention UI? | Notification only (no auto-dial) |
| Completing callback stops repeats? | `overdueNotifiedAt` guard prevents duplicate notifications |
| **Fix in this pass** | `operatingPolicy.callbackSla` compiled on `VoiceV3AgentConfig` (was missing → SLA metadata never applied on `request_callback`) |
| **UI** | `CallbackSlaEditor` copy updated to describe notification-only behavior (no invented auto-dial SLA) |

**Classification:** **WORKING** for deadline + overdue notification; not a full auto-escalation / auto-dial product.

### 4. SCREEN / `suspectedSpamLikely` — **connected (conditional)**

| Step | Status |
|------|--------|
| Telnyx `flag_calls` + trunk `X-Telnyx-Call-Screening` → LiveKit `transovo.telnyx.call_screening` | Infrastructure on master (`telnyx-spam-header-trunk.ts`) |
| Python bootstrap reads participant attr | **Yes** — forwarded as `telnyxCallScreeningRaw` |
| TS `resolveVoiceV3LiveKitSession` | Normalizes via `normalizeTelnyxScreeningValue`; sets `suspectedSpamLikely` for SCREEN policy prompt hint |
| Astra/GPT-Live context | `buildAmySpamSolicitorInstructions(..., { suspectedSpamLikely })` |
| Call metadata | `mergeVoiceV3ScreeningOnCall` when raw header present |
| **Caveat** | If trunk header mapping missing or Telnyx sends no header, attribute is absent — **no new transport invented**; DECLINE/report/block path unchanged |

### 5. Spam / solicitor (prior commit on branch) — **unchanged architecture**

`report_unwanted_solicitor` via TS catalog + LiveKit blocklist gate — not rewritten.

## C. Protected surfaces

- Website / legal / MCTB / SMS platform paths: **no diff** vs `3b3945b3`
- `runVoiceV3CallHistoryPostProcess`: **extended** only with async side-effect IIFE (recording/transcript/summary path unchanged)
- FileSearch, Microsoft booking, forensics, GPT-Live/Sol: **unchanged**

## D. Wizard connectivity matrix (final candidate)

| Area | Status |
|------|--------|
| Spam DECLINE + `report_unwanted_solicitor` | **WORKING** |
| Spam SCREEN (carrier hint) | **WORKING** when Telnyx header + trunk mapping present; otherwise policy still works without hint |
| Blocked caller handling | **WORKING** (bootstrap gate) |
| AI Call Recovery | **WORKING / EXTERNAL SETUP REQUIRED** + **BUILT / NEEDS PSTN CERTIFICATION** |
| Callback SLA | **WORKING** (deadline persist + overdue in-app notification); not auto-dial |
| Post-call webhooks | **WORKING** (when workspace webhooks configured) |
| Knowledge gaps | **WORKING** (when LLM summary produces candidates) |
| Google Calendar | **BUILT / NEEDS PSTN CERTIFICATION** |
| Warm / waterfall transfer | **BUILT / NEEDS PSTN CERTIFICATION** |
| Calendly V3 | **GENUINELY NOT IMPLEMENTED** |
| Quality Studio | **DEFERRED / HIDDEN** |

## E. Implemented vs external vs cert vs gaps

### Implemented and source-complete (wired)

- Spam solicitor tool + blocklist gate
- Carrier SCREEN hint at LiveKit bootstrap (when metadata present)
- Post-call webhook queueing on call-history completion
- Knowledge-gap persistence from post-call summary
- Callback SLA compile → persist → overdue scan → notification

### External setup required

- AI Call Recovery SMS sender, wizard flags
- Knowledge base indexing / FileSearch vector stores
- Telnyx `flag_calls` + inbound trunk spam header mapping for SCREEN hints

### Needs real PSTN certification

- Google booking path
- Recovery SMS end-to-end
- Warm/waterfall transfer
- Spam DECLINE/SCREEN behavior on live PSTN

### Genuine remaining product gaps

- Calendly V3
- Quality Studio
- Callback SLA: no auto-dial / no SMS escalation (by design — documented in UI)

### Intentionally deferred

- Quality Studio, Calendly V3, wholesale historical merges

## F. Zero-loss diff (vs `origin/master` @ `3b3945b3`)

| Metric | Value |
|--------|--------|
| Files changed | **22** |
| Insertions / deletions | **+781 / −12** (approx.) |
| Deleted files | **0** |
| Renamed files | **0** |
| Migrations added | **0** |
| Migrations removed | **0** |
| Protected-path diffs | **none** (narrow Voice wizard SLA copy only) |

Final candidate SHA: `4c64127d` (branch tip; includes spam commit `e41181e8` + closure commit).

## G. Tests

| Script | Result |
|--------|--------|
| `scripts/test-voice-v3-qualification-urgency.ts` | PASS |
| `scripts/test-voice-v3-wizard-backend-propagation.ts` | PASS (209/209) |
| `scripts/test-voice-v3-spam-solicitor-tool.ts` | PASS |
| `scripts/test-voice-v3-post-call-closure.ts` | PASS |

No local production build. No Coolify deploy.

## H. STOP BEFORE MERGE

Do **not** merge or deploy until explicitly approved.
