# Voice V3 — 8-step wizard completion status (production master)

**Baseline:** `master` @ `47adf8d5f20be4f93aafd1aa5fa987285e61e0ff` (post-merge/deploy)  
**Control inventory:** `buildWizardV3FieldManifest()` — **214 rows**  
**Backend propagation cert:** **209/209 PASS** (`scripts/test-voice-v3-wizard-backend-propagation.ts`)  
**Line-by-line list:** `/opt/cursor/artifacts/wizard-8-step-completion-matrix.md` (regenerate: `npx tsx scripts/export-wizard-8-step-matrix.ts`)

**MCTB step labels:** Purpose → Phone → Business Knowledge → Booking → Call Handling → Voice → Test → Activate

---

## How to read “completed”

| Label | Meaning |
|--------|--------|
| **WORKING** | Wizard → compiler → Voice V3 LiveKit/GPT-Live runtime (tools, prompts, or policy). |
| **WORKING + external** | Wired in code; needs OAuth, indexed KB, SMS sender, etc. |
| **BUILT / PSTN cert** | Source-complete; not yet proven on a real call. |
| **PARTIAL** | Persists/compiles but limited product behavior or weak gate (e.g. Test). |
| **DISPLAY ONLY** | Setup/provisioning/UI; not an in-call V3 behavior knob. |
| **NOT IMPLEMENTED** | No V3 path (Calendly). |
| **DEFERRED** | Hidden / out of scope (Quality Studio). |

---

## Step 1 — Purpose (10 controls)

| Status | Items |
|--------|--------|
| **Completed** | All **8 capability toggles** (`answer_questions`, `book_appointments`, `reschedule`, `cancel`, `take_messages`, `qualify_callers`, `transfer_calls`, `send_sms_confirmations`) → catalog + authorization. |
| **DISPLAY ONLY** | `answerWhen` (routing/provisioning), `solutionName` (workspace label). |

**Not missing** for V3 runtime on this step.

---

## Step 2 — Phone (12 controls)

| Status | Items |
|--------|--------|
| **Completed** | Inbound `phoneNumberId` / `phoneNumberE164`, **call recording**, **connection greeting** (mode/text/audio URL). |
| **WORKING + external** | Outbound SMS trio (`outboundSmsMode`, ids, E.164) — used for **send booking link** + **AI call recovery** when sender configured. |
| **DISPLAY ONLY** | `numberSource`, `ringBehavior`, `ringTeamSeconds` (Telnyx/routing shell, not in-call V3 logic). |

---

## Step 3 — Business Knowledge (64 controls)

| Status | Items |
|--------|--------|
| **Completed** | `businessName`, `timezone`, all **knowledge item** fields, full **weekly hours + holidays**, **after-hours when-closed** matrix, **on-call schedule** entries, **callback SLA** (4 fields — deadline + overdue **in-app notification**; **no auto-dial**). |
| **WORKING + external** | `knowledgeSource`, `linkedKnowledgeBaseId`, `knowledgeBaseEnabled`, `knowledgeBaseRevision`, `websiteUrl` — runtime is **FileSearch / vector stores + crawl/index**, not a second RAG engine. |

**Note:** Operating-maturity fields appear in the manifest under step 3 because they share the Information / maturity editors; they **are** wired to `operatingPolicy` + transfer/callback runtime.

**Not wizard leaves (shipped on master):** workspace **post-call webhooks** and **knowledge-gap persistence** — backend only, not wizard UI controls.

---

## Step 4 — Booking (37 controls)

| Status | Items |
|--------|--------|
| **Completed** | `calendarProvider` / connected / email, **booking strategy** (Microsoft + **REQUEST_ONLY** + **SEND_LINK**), **booking behavior** (6 toggles), **collect fields** (5 × schema), `selectedAppointmentTypeId`, `durationMin`, `enabled` on types. |
| **WORKING + PSTN cert** | **Google** path when strategy/provider = Google (code on master; **not PSTN-certified**). |
| **Manifest says PARTIAL; propagation says wired** | Most **`appointmentTypes[]`** facets, **`bookingLinkUrl` / `bookingLinkLabel`** — compiler + `send_booking_link` / services; treat as **WORKING** (manifest `CONFIGURED_NOT_IMPLEMENTED` is stale). |
| **NOT IMPLEMENTED** | All **4 Calendly** fields (`calendlyEventType*`, `calendlyTimezone`). |

---

## Step 5 — Call Handling (56 controls)

| Status | Items |
|--------|--------|
| **Completed** | Full **qualification** stack (enable, rules, zip codes, fallbacks), **urgency** rules (except transfer-plan link), **callbacks** (enable, required collect fields), **transfer destinations**, legacy transfer name/phone/triggers/fallback/ring seconds, **spam/solicitor** via `salesSolicitationEnabled` + `salesSolicitationAction` → `report_unwanted_solicitor` + blocklist (**PSTN cert remaining**). |
| **BUILT / PSTN cert** | `warmTransfer`, `detectVoicemailOnTransfer`, `transferRouting`, **transfer plan steps** (order, destination, mode, timeout), `urgencyRules[].transferPlanId`. |
| **WORKING + external + PSTN cert** | All **6 `aiCallRecovery*`** fields (post-call SMS hook; needs sender + flags + live SMS proof). |
| **Treat as WORKING** (manifest understates) | `voiceV2HumanTransferEnabled`, `allowCallerRequestedTransfer`, `defaultTransferPlanId`, callback UX flags (`callbackUseAniByDefault`, `callbackAskPreferredTime`, `callbackConfirmNumber`) — consumed by callback/transfer executors; **209/209** propagation includes them. |

**Carrier spam SCREEN/BLOCK** is mostly **publish/Telnyx + bootstrap hint**, not separate wizard leaves beyond solicitation action.

---

## Step 6 — Voice (23 controls)

| Status | Items |
|--------|--------|
| **Completed** | `agentName`, `role`, `tone`, `speakingStyle`, `language`, `speaksFirst`, `openingGreeting`, `voiceId`, **conversation behaviors** (5), **guardrails**, prompt knobs (`speakingPace`, `voiceAccent`, `backchannelLevel`, `callerPausePatience`, `interruptionStyle`). |
| **DISPLAY ONLY** | `voiceLabel`, `voiceSource`, `openAiCustomVoiceId` (catalog/metadata; live voice is GPT-Live `liveVoiceId` path). |

---

## Step 7 — Test (2 controls)

| Status | Items |
|--------|--------|
| **PARTIAL** | `testScenario`, `lastTestPassed` — **static/backend certs PASS**; **not** a hard production gate on live browser/PSTN for every publish. |

---

## Step 8 — Activate (5 controls)

| Status | Items |
|--------|--------|
| **DISPLAY ONLY** | `activationMode`, `scheduledAt`, `longTermMemory` (lifecycle / flags; not per-utterance V3). |
| **PARTIAL** | `crmEnabled` — compiles/persists; CRM push is **not** a certified V3 call-path feature. |
| **DEFERRED** | `qualityStudioLastRun` — **Quality Studio** not shipped. |

---

## Roll-up (214 manifest rows)

| Bucket | Count |
|--------|------:|
| **WORKING** (in-call / tools / policy) | 135 |
| **Manifest “PARTIAL”** (mostly **actually WORKING** per 209/209 propagation) | 22 |
| **DISPLAY ONLY** (provisioning) | 16 |
| **BUILT / NEEDS PSTN CERT** | 8 |
| **AI recovery (+ external)** | 6 |
| **Prompt-only WORKING** | 5 |
| **FileSearch / KB (+ external)** | 4 |
| **Callback SLA** (notification, no auto-dial) | 4 |
| **Calendly NOT IMPLEMENTED** | 4 |
| **Outbound SMS (+ external)** | 3 |
| **Spam PSTN cert** | 2 |
| **Test PARTIAL** | 2 |
| **Booking strategy (Google cert)** | 1 |
| **Website crawl (+ external)** | 1 |
| **Quality Studio DEFERRED** | 1 |

---

## What is NOT “completed” in a product sense (honest gaps)

1. **Calendly V3** — 4 wizard fields, no runtime.
2. **Quality Studio** — deferred/hidden.
3. **Live Test gate** — checklist exists; **not** enforced by real PSTN/browser cert on deploy.
4. **Google booking** — built; **PSTN certification** pending.
5. **Warm / waterfall / plan transfers** — built; **PSTN certification** pending.
6. **Spam DECLINE / SCREEN / blocklist** — built on `47adf8d5`; **PSTN certification** pending.
7. **AI Call Recovery SMS** — wired; **sender + PSTN SMS** proof pending.
8. **FileSearch / KB / website** — wired; **indexing/OAuth/crawl** is customer setup.
9. **Callback SLA** — deadlines + overdue **notification** only; **no** auto-dial/SMS escalation (by design).
10. **Provisioning-only** controls (number source, ring team, answer-when, some activate fields) — **not** V3 in-call features.

---

## Cross-check vs merge/deploy connectivity

On production master after merge:

- Spam/solicitor tool, SCREEN bootstrap hint, blocked-caller gate — **shipped**
- Post-call webhooks + knowledge-gap persistence — **shipped** (not wizard steps)
- Callback SLA compile + truthful wizard copy — **shipped**
- Microsoft FIND/BOOK — **known certified path** (unchanged)
- PSTN certification matrix — **next phase** (Google, recovery SMS, spam, transfers)

---

## Regenerate line-by-line matrix

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/export-wizard-8-step-matrix.ts
```

Output: `/opt/cursor/artifacts/wizard-8-step-completion-matrix.md` (every control with state path + status).
