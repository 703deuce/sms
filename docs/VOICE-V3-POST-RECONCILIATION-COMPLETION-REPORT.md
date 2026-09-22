# Voice V3 — post-reconciliation completion report

**STOP BEFORE MERGE** — awaiting explicit approval.

## A. Starting state

| Item | Value |
|------|--------|
| `origin/master` @ fetch | `3b3945b3004b7142b95dff6c3a3c3c8b3c91e5ff` (includes reconciliation merge) |
| New branch | `cursor/voice-v3-post-reconciliation-completion-2304` |
| Branch created from | `origin/master` @ `3b3945b3` |
| Historical branches merged | **none** |

## B. Capability inspection (remaining items)

### 1. LiveKit spam / solicitor completion

| | Detail |
|---|--------|
| **Master already had** | Wizard → compiler `spamProtection`; Telnyx screening publish sync; blocklist APIs + Prisma; prompt copy in `prompt-sections.ts` (unused in Astra instructions); billing metadata helpers |
| **Actually missing** | `report_unwanted_solicitor` FunctionTool in catalog; deterministic executor; Astra spam/solicitor instructions in `buildAstraBackendInstructions`; blocked-caller rejection at LiveKit session bootstrap |
| **Historical reference** | Gap branch Python `solicitor_outcome.py` (behavior only — implemented via TS tool + existing blocklist/billing on master) |
| **Files changed** | `report-unwanted-solicitor-tool.ts`, `record-solicitor-outcome.ts`, `voice-tool-catalog.ts`, `authorize-tool-for-config.ts`, `astra-backend-instructions.ts`, `voice-v3-livekit.ts` (blocklist gate only), `scripts/test-voice-v3-spam-solicitor-tool.ts` |
| **Why** | Prompts referenced a tool that did not exist in the GPT-Live delegation catalog; DECLINE policy had no runtime consumer |

**Not done (by design):** Python-native `report_unwanted_solicitor` in `voice-runtime-python` — master architecture uses TS catalog tools via `execute_voice_v3_livekit_tool`. No wholesale `voice-v3-livekit.ts` replacement.

### 2. Google Calendar — verify integrated path

| | Detail |
|---|--------|
| **Master already had** | Full `calendar/google/*`, `calendar-provider-runtime.ts`, compile/from-published Google connections, FIND/BOOK dispatch with `persist-booking-after-confirmation` |
| **Actually missing** | Nothing in source for this pass |
| **Status** | **BUILT / NEEDS PSTN CERTIFICATION** |
| **Files changed** | none |

### 3. AI Call Recovery — verify chain

| | Detail |
|---|--------|
| **Master already had** | `maybeSendVoiceV3AiCallRecoverySms` hooked from `runVoiceV3CallHistoryPostProcess`; `resolve-voice-v3-outbound-sms.ts`; wizard recovery flags on compiled config |
| **Actually missing** | No code gap identified; requires SMS sender + wizard flags + `continueOverSms` |
| **Status** | **WORKING / EXTERNAL SETUP REQUIRED** (sender/flags); **BUILT / NEEDS PSTN CERTIFICATION** for live SMS proof |
| **Files changed** | none |

### 4. Warm / waterfall transfer

| | Detail |
|---|--------|
| **Master already had** | `transfer_call` tool, `authorize-transfer.ts` with urgency, on-call, after-hours gating, waterfall route execution |
| **Actually missing** | No additional semantics identified vs gap branch without PSTN evidence |
| **Status** | **BUILT / NEEDS PSTN CERTIFICATION** |
| **Files changed** | none |

### 5. Callback SLA

| | Detail |
|---|--------|
| **Master already had** | Wizard SLA fields; `callbackSlaMetadataPatch` on callback persist; overdue job in operating-maturity layer |
| **Actually missing** | Wizard manifest still lists some SLA paths as “future”; operational customer-facing SLA enforcement narrative not fully certified |
| **Status** | **PARTIAL** — metadata + job exist; full product SLA behavior not certified |
| **Files changed** | none (no speculative SLA subsystem added) |

### 6. Post-call webhook / knowledge-gap processing

| | Detail |
|---|--------|
| **Master already had** | Prisma models + migrations; `webhooks/delivery.ts`; call-history post-process pipeline |
| **Actually missing** | `emitVoiceV3PostCallWebhooks` and `persistKnowledgeGapCandidates` not wired to `runVoiceV3CallHistoryPostProcess` (gap used separate `processVoiceV3CompletedCall`) |
| **Status** | **PARTIAL** — infrastructure present; hooks deferred to follow-up (per deployment scope) |
| **Files changed** | none |

### 7. Recording / transcript / summary

| | Detail |
|---|--------|
| **Master already had** | Full `call-history/*` pipeline, Deepgram fallback, summary, no customer infra cost surfacing in reviewed paths |
| **Actually missing** | No defect found in inspection |
| **Status** | **WORKING** (pending any outstanding PSTN cert for end-to-end proof) |
| **Files changed** | none |

## C. Protected surfaces

Explicitly confirmed unchanged vs `origin/master` for website/legal/MCTB sample paths and architecture:

- Website/legal/MCTB routes: **no diff** on protected paths
- Voice architecture: GPT-Live + Sol delegation, LiveKit bridge (**surgical** blocklist check only)
- `runVoiceV3CallHistoryPostProcess`: **unchanged**
- FileSearch / `resolve-agent-knowledge-retrieval`: **unchanged**
- Microsoft booking + `persist-booking-after-confirmation`: **unchanged**
- Forensics: **unchanged**
- No historical branch wholesale merge

## D. Wizard connectivity matrix (summary)

Full leaf propagation cert on master baseline: **209/209 PASS** (`test-voice-v3-wizard-backend-propagation.ts`).

| Area | Representative controls | Status (post branch) |
|------|-------------------------|----------------------|
| Purpose / capabilities | Capability cards | WORKING |
| Phone / recording | Number, greeting, recording | WORKING / EXTERNAL SETUP REQUIRED |
| Knowledge | FileSearch, crawl, uploads | WORKING / EXTERNAL SETUP REQUIRED |
| Booking Microsoft | FIND/BOOK + persistence | WORKING |
| Booking Google | Provider stack | BUILT / NEEDS PSTN CERTIFICATION |
| REQUEST_ONLY / SEND_LINK | Tools + compiler | WORKING |
| Transfer / urgency / on-call / after-hours | authorize-transfer + tools | WORKING / BUILT NEEDS PSTN CERT (warm/waterfall) |
| Spam / solicitation | DECLINE + `report_unwanted_solicitor` | **WORKING** (this branch); carrier SCREEN via Telnyx publish |
| Messages | `take_message` | WORKING |
| Callbacks | `request_callback` | WORKING |
| Callback SLA | Wizard targets | PARTIAL |
| AI Call Recovery | Post-call SMS hook | WORKING / EXTERNAL SETUP REQUIRED |
| Post-call webhooks / knowledge gaps | Schema only | PARTIAL |
| Calendly V3 | — | GENUINELY NOT IMPLEMENTED |
| Quality Studio | — | DEFERRED / HIDDEN |
| Test step | Live V3 vs metadata | PARTIAL (browser live not run) |
| Activate / publish | Compiler + LiveKit bootstrap | WORKING |

## E. Remaining genuine gaps (after this branch)

1. Post-call webhook delivery + knowledge-gap persistence on call-history completion  
2. Callback SLA operational behavior vs wizard copy  
3. PSTN certification matrix (Google, recovery SMS, spam policy, warm/waterfall)  
4. Calendly V3  
5. Quality Studio  
6. Optional: Telnyx `suspectedSpamLikely` injected into live session prompts (SCREEN policy) when header metadata available at bootstrap  

## F. Zero-loss diff (vs `origin/master` @ `3b3945b3`)

| Metric | Value |
|--------|--------|
| Files changed | 7 (4 modified + 3 added) |
| Insertions / deletions | ~+250 / −4 (approx., includes new modules + test) |
| Deleted files | **0** |
| Renamed files | **0** |
| Migrations added | **0** |
| Migrations removed | **0** |
| Protected-path diffs | **none** |

## G. Tests

| Script | Result |
|--------|--------|
| `scripts/test-voice-v3-qualification-urgency.ts` | PASS |
| `scripts/test-voice-v3-wizard-backend-propagation.ts` | PASS |
| `scripts/test-voice-v3-spam-solicitor-tool.ts` | PASS |

No local production build. No Coolify deploy (awaiting merge approval).

## H. STOP BEFORE MERGE

Do not merge `cursor/voice-v3-post-reconciliation-completion-2304` into `master` until this report is approved.
