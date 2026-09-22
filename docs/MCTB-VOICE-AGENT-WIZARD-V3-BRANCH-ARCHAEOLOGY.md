# MCTB Voice Agent wizard — off-master branch archaeology

**Purpose:** Reconcile the [V3 connectivity audit](./MCTB-VOICE-AGENT-WIZARD-V3-CONNECTIVITY-AUDIT.md) with work that may already be **finished on feature branches** but not merged to `master`.

**Baseline:** `origin/master` @ `d5db122e` (2026-09-22).  
**Method:** `git fetch`, `git merge-base`, `git diff`, and targeted `git grep` on `cursor/voice-v3-*`, `cursor/google-calendar-voice-v3-*`, and related branches.

---

## Executive summary

| Finding | Action |
|---------|--------|
| **`cursor/voice-v3-gap-closure-2304`** is the main **unmerged completion bundle** (~31 commits ahead of merge-base, ~35 behind current `master`). It wires urgency, on-call/after-hours gating, AI call recovery SMS, spam/solicitation, `take_message`, delegated `search_business_knowledge`, qualification hardening, and more. | **Merge or cherry-pick** after reconciling with `master` (call-history post-call, FileSearch RAG, marketing/docs commits). |
| **`cursor/voice-v3-final-completion-2304`** is **7 commits ahead of gap-closure** (intake prompt fix, crawl/billing/forensics guards). | Treat as **gap-closure + small delta**; merge gap-closure first, then replay final-completion commits. |
| **`cursor/google-calendar-voice-v3-implementation-2304`** | Large provider slice; **already included in gap-closure history** (commits `2c6599e6`, `965702b4`, etc.). Not on `master` as a standalone merge. |
| **`cursor/voice-v3-spam-solicitor-protection-2304`** | **Merged into gap-closure** (`027d5eff merge: integrate Voice V3 spam/solicitor protection`). Still **not** on `master`. |
| **`cursor/calendly-booking-mode-2304`**, **`cursor/voice-v2-ai-call-recovery-2304`** | **Ancestors of `master`** — any V2 recovery *plumbing* is on `master`, but V3 wizard recovery fields still do not drive live SMS (see below). |
| **`cursor/voice-v3-after-hours-post-call-2304`** | **Not merged**; overlaps gap-closure post-call processor. `master` has a **different** path: `runVoiceV3CallHistoryPostProcess` (transcript/summary), not the full gap `processVoiceV3CompletedCall` side-effect bundle. |

**Do not assume “Not connected” on the audit means “never built.”** Often it means **“not on `master`”** or **“compiled but executor not imported.”**

---

## Connectivity audit items vs branches

Ratings refer to the original audit; **Revised on `master`** reflects what `master` actually has today. **Off-master completion** names the branch/files if behavior is implemented elsewhere.

### Call Handling — urgency, on-call, after-hours, recovery, solicitation

| Wizard control (audit) | Audit rating | On `master` today | Off-master completion | Key paths (off-master) |
|------------------------|--------------|-------------------|------------------------|---------------------------|
| **Urgent-call handling** + rules | Not connected | `evaluateVoiceV3Urgency` exists; **no runtime caller** in `authorize-transfer` / callback | **Implemented** on `voice-v3-gap-closure-2304` | `src/lib/voice-v3/transfer/authorize-transfer.ts`, `callback/execute-request-callback.ts` |
| **On-call schedule** | Not connected | `operating-maturity/on-call.ts` + `behavior-gating.ts` on disk; **`applyOperatingMaturityToCallContext` not used by V3 transfer path** | **Wired in transfer auth** on gap-closure | Same `authorize-transfer.ts` diff (imports `resolveActiveOnCallTarget`, `gateCapabilitiesForOperatingState`) |
| **After-hours behavior** (`whenClosed.*`) | Not connected | Compiled; gating helpers exist | **Used in transfer path** on gap-closure | `behavior-gating.ts` + `authorize-transfer.ts` |
| **Callback SLA** selects | Not connected | `callback-sla.ts`, `callback-overdue-job` job handler on `master`; manifest still **future** | Gap-closure may align manifest; **no proof of in-call enforcement** on either branch | `operating-maturity/callback-overdue-job.ts` (master) |
| **AI Call Recovery** (all fields) | Not connected | Wizard → `config.recovery.*`; `voice_v2_ai_call_recovery_settle` job is **no-op** (`settle-job.ts` returns `skipped: true`) | **V3 SMS executor** on gap-closure | `src/lib/voice-v3/post-call/ai-call-recovery-sms.ts`, hooked from `post-call/process-completed-call.ts` |
| **Sales / solicitation handling** | Not connected | Compile only on `master` | **Full spam protection stack** on gap-closure (from spam branch) | `src/lib/voice-v3/spam-protection/*`, Telnyx screening sync, wizard editor `spam-unwanted-calls-editor.tsx` |

### Business Knowledge — RAG

| Wizard control | Audit rating | On `master` today | Off-master |
|----------------|--------------|-------------------|------------|
| **Search uploaded documents during calls** | Partial (“no retrieve tool”) | **`useGptLiveFileSearchRag()` + OpenAI vector stores** → LiveKit **FileSearch** (`resolve-agent-knowledge-retrieval.ts`, `voice-v3-livekit.ts`). Prompt path in `astra-knowledge-instructions.ts`. Requires indexed KB + env flag. | Gap-closure adds **delegated** `search_business_knowledge` tool (`tools/search-business-knowledge-tool.ts`) in addition to FileSearch |
| **Revised rating on `master`** | **Partial → Partial+** | Live RAG **when** vector stores exist; still not the legacy Telnyx embedding path. Checkbox alone does not help without ingest + indexing. | Merge gap for dual-path (FileSearch + delegated tool) if desired |

### Booking — Calendly, Google, send-link, per-type fields

| Wizard control | Audit rating | On `master` | Off-master |
|----------------|--------------|-------------|------------|
| **Calendly — book on call** | Not connected | Manifest `FUTURE_CALENDLY`; no `voice-v3` Google/Calendly provider grep on `master` | `calendly-booking-mode-2304` is **in master history** but **V3 executor still absent** on current `master` |
| **Google Calendar strategy** | Partial / N/A | **No** `GOOGLE_CALENDAR` in `src/lib/voice-v3` on `master` | **`google-calendar-voice-v3-implementation-2304`** and **gap-closure** (provider module + book dispatch) |
| **Send booking link** | Partial | `send_booking_link` in catalog; SMS plumbing varies | Gap-closure adds `sms/resolve-voice-v3-outbound-sms.ts`, `send-booking-confirmation-sms.ts` |
| **Per-type notice / calendar / required fields** | Partial | Manifest NI rows on `master` | Gap-closure commit `3e16d2b5` claims **per-service intake** + REQUEST_ONLY closure — verify at merge |

### Transfer — waterfall

| Wizard control | Audit rating | On `master` | Off-master |
|----------------|--------------|-------------|------------|
| **Waterfall routing** | Partial | `authorize-transfer.ts` sets `waterfall` + `waterfall_attempt_count` | gap-closure / `voice-v3-transfer-system-2304` — compare for warm-transfer/step timeouts; **no single “done” branch isolated from gap** |
| **Transfer contacts warm mode** | Partial | Same | oncall-transfer-hardening branch ≈ same transfer files as `master`; **urgency/on-call** delta is mainly in gap-closure |

### Tools missing on `master` but present on gap-closure

| Tool | `master` catalog | `voice-v3-gap-closure-2304` |
|------|------------------|-----------------------------|
| `take_message` | Absent | `tools/take-message-tool.ts` |
| `search_business_knowledge` | Absent (FileSearch provider only) | `tools/search-business-knowledge-tool.ts` |

### Post-call / notifications

| Area | `master` | gap-closure |
|------|----------|-------------|
| Transcript + summary | `call-history/post-call-pipeline.ts` | Unified `post-call/process-completed-call.ts` (+ email, webhooks, knowledge gaps) |
| Staff after-hours notifications (wizard) | Partial (compile); check `voice-v3` notify handlers | `webhooks/delivery.ts`, richer post-call bundle |
| AI recovery SMS | **Not wired** | `maybeSendVoiceV3AiCallRecoverySms` |

---

## Recommended merge order (engineering)

1. **Rebase or merge `origin/master` into `cursor/voice-v3-gap-closure-2304`** (resolve ~35 master-only commits: call history, FileSearch cert, MCTB marketing, forensics docs).
2. Run on the integrated branch:
   - `npx tsx scripts/test-voice-v3-wizard-backend-propagation.ts`
   - `npx tsx scripts/test-voice-v3-qualification-urgency.ts` (exists on gap-closure; urgency should pass integration once merged)
   - Existing V3 cert scripts you use for PSTN (`verify:mctb-final-pipeline` only for MCTB TeXML — separate product path)
3. **Cherry-pick or merge `voice-v3-final-completion-2304`** (7 commits) for intake prompt + crawl/billing guards.
4. **Re-run this archaeology** after merge — update audit ratings for urgency, recovery, spam, on-call, and RAG.

---

## Supporting docs on gap-closure (not on `master`)

These files are useful during merge; copy or merge with the branch:

- `docs/AI-VOICE-AGENT-GAP-REGISTER.md`
- `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md`
- `docs/AI-VOICE-AGENT-FEATURE-STATUS.md`
- `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md`

---

## What is *not* saved by merging gap-closure alone

- **MCTB Call handling** card (`PATCH /api/mctb/inbound-handling`) — still outside wizard republish (by design).
- **Calendly live V3 FIND/BOOK** — still **P0 gap** per gap register even on gap-closure branch (verify before promising customers).
- **Agent Quality Studio** — stub on all inspected branches.
- **Wizard “deployment schedule Mon–Fri 8–6”** display — cosmetic; unrelated to merge.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-22 | Initial archaeology vs `master` `d5db122e` |
