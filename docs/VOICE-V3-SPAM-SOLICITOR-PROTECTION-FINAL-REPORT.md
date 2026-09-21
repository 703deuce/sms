# Voice V3 — Spam & Solicitor Protection — Final Report

**Branch:** `cursor/voice-v3-spam-solicitor-protection-2304`  
**Commit:** `65508a11`  
**Draft PR:** https://github.com/703deuce/sms/pull/456  
**Audit (implementation):** `docs/VOICE-V3-SPAM-SOLICITOR-PROTECTION-AUDIT.md`

**Status:** Two-layer architecture implemented per spec — Telnyx `reject_calls` for BLOCK (no LiveKit/GPT-Live) and Amy solicitor policies with billing disposition for confirmed junk.

---

## A. Repository audit

| Area | What we reuse |
|------|----------------|
| **Telnyx** | `telnyxRequest` from `@/lib/messaging/telnyx/client`; narrow PATCH `/phone_numbers/{id}/voice` (same pattern as `inbound-diagnostics.ts`) |
| **Number identity** | `phoneNumber.providerNumberId` + workspace scoping in `sync-telnyx-inbound-screening.ts` |
| **Wizard → config** | `compileVoiceV3AgentConfig` + manifest/inventory fields for `spamLikelyPolicy` / `solicitorPolicy` |
| **LiveKit trunk** | `ensureInboundTrunkForNumber` + **merge** `headersToAttributes` in `telnyx-spam-header-trunk.ts` |
| **Python startup** | `session.py` — resolve config **before** `GPTLiveModel` / `AgentSession`; blocklist → `room.disconnect()` |
| **Call outcomes** | `voiceCall.outcome` + `metadata.voiceV3Screening` (no new classification table) |
| **Billing** | `voiceUsageRecord.billedCostCents` + `voiceCall.costCents` via `applyUnwantedSolicitorCustomerBilling` |
| **End call** | Native `EndCallTool` unchanged |
| **Calls UI** | API only: `POST /api/voice/calls/[id]/block-caller` — **Inbox/Detail badges & screening section not built yet** |

---

## B. Telnyx implementation

- **Client:** existing `telnyxRequest` (not a second SDK).
- **Method:** `PATCH /phone_numbers/{providerNumberId}/voice` with body `{ inbound_call_screening }` only.
- **Mapping (locked):**
  - `BLOCK` → `reject_calls`
  - `SCREEN` → `flag_calls`
  - `ALLOW` → `flag_calls` (signal retained; Amy ignores flag — documented in audit doc)
- **Publish:** `syncVoiceV3SpamProtectionOnPublish` → failure **rolls back** publish with customer-facing error text.
- **Sync state:** `phoneNumber.metadata.voiceV3SpamScreeningSync` (desired/confirmed mode, timestamp, error).
- **Idempotency:** read current mode; skip PATCH if already matches.
- **Backward compat:** `spamLikelyPolicy === null` → **no** Telnyx mutation until publish sets policy (legacy agents not silently switched to BLOCK).
- **Production read-back proof:** not run from cloud VM against live DIDs.

**Key files:**

- `src/lib/voice-v3/spam-protection/sync-telnyx-inbound-screening.ts`
- `src/lib/voice-v3/spam-protection/publish-sync.ts`
- `src/lib/voice/agent-service.ts` (publish rollback on sync failure)

---

## C. LiveKit implementation

- **Installed:** `livekit-agents==1.8.2` (per repo pin).
- **Header path:** `X-Telnyx-Call-Screening` → participant attr `transovo.telnyx.call_screening` via trunk `headersToAttributes` merge on provision.
- **Runtime:** Python reads attrs (`transovo.telnyx.call_screening`, `sip.h.X-Telnyx-Call-Screening`) and passes `telnyxCallScreening` into `resolve_voice_v3_livekit_session`.
- **GetRemoteHeaders:** **not used** — no reliable API found in installed 1.8.2 Python package; no `asyncio.sleep` hack. SCREEN uses attr when present at resolve time (may be late on some calls — webhook path still optional follow-up).
- **BLOCK:** by design **no** LiveKit job for carrier-rejected spam (Telnyx edge only).

**Key files:**

- `src/lib/telephony/provisioning/livekit/telnyx-spam-header-trunk.ts`
- `src/lib/telephony/provisioning/number-assignment.ts` (header merge on provision)
- `voice-runtime-python/transovo_voice/voice_v3/session.py`
- `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`

---

## D. Wizard

- **Placement:** Call Handling — `SpamUnwantedCallsEditor` next to Emergency & transfer (`call-handling-step.tsx`).
- **Defaults (new agents):** `spamLikelyPolicy: BLOCK`, `solicitorPolicy: DECLINE` in `createDefaultWizardState()`.
- **Pipeline:** types → merge-on-save → compiler → `VoiceV3AgentConfig.spamProtection` → publish sync.
- **Round-trip test:** `npx tsx scripts/test-voice-v3-spam-solicitor-protection.ts` — **PASS**.
- **Browser screenshots / save→reload→publish UI cert:** not captured in cloud environment.

**Key files:**

- `src/components/solutions/appointment-receptionist/spam-unwanted-calls-editor.tsx`
- `src/lib/solutions/appointment-receptionist/types.ts`, `defaults.ts`, `merge-wizard-state-on-save.ts`
- `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts`

---

## E. Solicitor behavior (Amy / Astra)

- **Prompts:** `spam-protection/prompt-sections.ts` → Live (Amy) + short Astra hint.
- **DECLINE:** polite close + native `end_call` hint in session config.
- **TAKE_MESSAGE:** callback/message wording; no separate SolicitorMessage system.
- **ALLOW:** no forced termination.
- **No** second LLM spam classifier.

---

## F. Billing

- **Solicitor (confirmed):** `applyUnwantedSolicitorCustomerBilling` — `customerBillable: false` in metadata, `costCents: 0` on call, `billedCostCents: 0` on usage rows; **`providerCostCents` not wiped**.
- **Carrier-blocked spam:** no Transovo usage path if call never arrives (no fabricated AI minutes).
- **Auto hook on end_call:** internal action `record_voice_v3_solicitor_outcome` exists; **not wired from EndCallTool yet** — solicitor billing today requires that hook or post-call pipeline call (follow-up).
- **Manual “mark spam” ≠ auto credit** — blocklist API does not grant credits.

**Key file:** `src/lib/voice-v3/spam-protection/billing.ts`

---

## G. Blocklist

- **Schema:** `VoiceCallerBlock` (`workspaceId`, `callerE164` unique) + migration `20260920194500_voice_v3_caller_blocklist`.
- **Gate:** `resolveVoiceV3LiveKitSession` → `preCallReject: blocklist` → Python disconnects **before** GPT-Live.
- **Limitation:** room/worker may still spin briefly; savings are “no GPT-Live,” not Telnyx-edge block.
- **Unblock / wizard “Manage” list:** not implemented (API list + UI follow-up).

**Key files:**

- `src/lib/voice-v3/spam-protection/blocklist.ts`
- `src/app/api/voice/calls/[id]/block-caller/route.ts`
- `prisma/schema.prisma` (`VoiceCallerBlock`)

---

## H. Tests

```bash
npx tsx scripts/test-voice-v3-spam-solicitor-protection.ts
# PASS voice-v3-spam-solicitor-protection
```

**Not yet:** full 9× wizard matrix, mocked Telnyx integration tests, synthetic SIP header integration test, billing integration tests.

**Script:** `scripts/test-voice-v3-spam-solicitor-protection.ts`

---

## I. Production deployment

- **Git SHA:** `65508a11` on PR #456.
- **Coolify web/voice:** not verified from cloud agent run.

---

## J. Carrier certification

- **Real Spam Likely PSTN + proof of zero LiveKit/GPT usage:** **not done** (needs Telnyx-flagged test caller).
- **Synthetic header test:** not added as dedicated integration fixture yet.

---

## K. PSTN certification

Not run (cloud agent cannot place certified spam-likely calls on production numbers).

---

## L. Latency

No before/after first-audio benchmark in this pass (blocklist = one indexed DB lookup on resolve).

---

## M. Remaining limitations (honest)

1. US/Canada reputation coverage — UI copy reflects “helps block calls Telnyx identifies as likely spam.”
2. False positives on BLOCK — Telnyx owns the decision; no Transovo allowlist override at carrier edge.
3. Carrier-rejected calls — likely **no** `VoiceCall` row unless Telnyx webhook/CDR ingested later.
4. Manual blocklist — after SIP/LiveKit ingress, not at Telnyx edge.
5. Call Inbox/Detail badges, screening panel, “Not charged” UI, blocked-caller manage/unblock in wizard.
6. `call_screening_result` on `call.initiated` webhook.
7. Automatic solicitor billing on `end_call` completion.
8. DB migration must be applied on target DB (`npm run db:deploy`); cloud migrate may hit environment-specific FK issues.

---

## Architecture confirmation (non-negotiable)

### BEST CASE — KNOWN SPAM

```
Spam caller
  → Telnyx reputation / validation / STIR-SHAKEN
  → SPAM LIKELY
  → BLOCK policy
  → TELNYX REJECTS
  → NO LIVEKIT
  → NO GPT-LIVE
  → NO AI BILLABLE MINUTES
```

### UNKNOWN SOLICITOR

```
Clean/new caller
  → Telnyx does not flag
  → LiveKit
  → Amy
  → Caller reveals unsolicited sales intent
  → DECLINE policy
  → Amy politely declines
  → native EndCallTool
  → UNWANTED_SOLICITATION
  → actual internal cost retained
  → customer billable = false (when billing hook runs)
```

### FALSE-POSITIVE-SENSITIVE BUSINESS

```
Telnyx Spam Likely
  → SCREEN policy
  → flag_calls
  → LiveKit receives screening signal
  → Amy answers
  → real customer intent
  → normal receptionist flow
```

**Principle:** Carrier reputation prevents known junk from costing AI money. Amy handles junk reputation cannot know. Transovo owns policy, billing truth, history, and manual blocklists — keep those separate.

**BLOCK must never:** route Spam Likely into LiveKit only to hang up — `reject_calls` at Telnyx edge is the economics path.

---

## Policy model (compiled)

```ts
spamProtection: {
  spamLikelyPolicy: "BLOCK" | "SCREEN" | "ALLOW" | null,  // null = legacy, no carrier sync
  solicitorPolicy: "DECLINE" | "TAKE_MESSAGE" | "ALLOW" | null,
}
```

**Telnyx mapping:**

| Transovo | Telnyx `inbound_call_screening` |
|----------|----------------------------------|
| BLOCK | `reject_calls` |
| SCREEN | `flag_calls` |
| ALLOW | `flag_calls` (observability; Amy ignores flag) |

---

## Suggested follow-up (same branch or new PR)

1. Call Detail screening section + **Block caller** button + confirmation modal  
2. Calls Inbox badges: Spam Likely / Solicitor  
3. Wire `record_voice_v3_solicitor_outcome` on solicitor `end_call`  
4. Synthetic LiveKit header integration test (labeled SYNTHETIC)  
5. Telnyx read-back script after publish on staging DID  
6. Blocked callers manage/unblock in wizard card  
7. Optional: `call_screening_result` on existing Telnyx webhook handler  

---

## Telemetry events (implemented / logged)

- `VOICE_V3_SPAM_POLICY_SYNC_STARTED`
- `VOICE_V3_SPAM_POLICY_SYNC_SUCCEEDED`
- `VOICE_V3_SPAM_POLICY_SYNC_FAILED`
- `VOICE_V3_SPAM_FLAG_RECEIVED`
- `VOICE_V3_BLOCKLIST_MATCH`
- `VOICE_V3_BLOCKLIST_CALL_REJECTED` (Python)
- `VOICE_V3_SOLICITOR_DECLINED` (on manual billing record path)

---

*Generated for copy/paste from Voice V3 Spam & Solicitor Protection implementation pass.*
