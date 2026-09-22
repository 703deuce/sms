# Call Handling Ownership Switch — Updated Report (canonical voice ingress)

**Status:** Updated per product decision — **do not merge / do not deploy**

- **Draft PR:** https://github.com/703deuce/sms/pull/483
- **Branch:** `cursor/call-handling-ownership-switch-2304`

---

## 1. Exact files changed (current PR + this update)

**New / call-handling core**

| File | Change |
|------|--------|
| `src/lib/call-handling/resolve-canonical-voice-ingress.ts` | **New** — canonical CFNA / voice ingress resolution |
| `src/lib/call-handling/resolve-ai-receptionist.ts` | **New** — AI agent independent of ingress DID |
| `src/lib/call-handling/outbound-sms-route-proof.ts` | **New** — SMS vs ingress documentation + test helpers (no runtime SMS changes) |
| `src/lib/call-handling/set-active-call-handler.ts` | Ingress-only Telnyx switch; no `syncVoiceAgentPhoneAssignment` |
| `src/lib/call-handling/readiness.ts` | MCTB readiness uses `voiceIngressPhoneNumberId` only (no `smsPhoneNumberId`) |
| `src/lib/call-handling/publish-gate.ts` | Ingress-scoped publish skip + `computePublishSkipIngressRouting` |
| `src/lib/call-handling/types.ts` | `voiceIngressPhoneNumberId`, `aiVoicePhoneNumberId` |
| `src/lib/call-handling/initial-selection.ts` | Persist on canonical ingress |
| `src/lib/call-handling/effective-handler.ts` | `connection_id` on ingress DID only |
| `src/lib/call-handling/phone-settings.ts`, `switch-lock.ts`, `show-switcher.ts` | (from initial PR) |

**API / UI / gates (initial PR + API param)**

| File | Change |
|------|--------|
| `src/app/api/call-handling/route.ts` | GET/PATCH; optional `voiceIngressPhoneNumberId` |
| `src/components/call-handling/call-handling-switcher.tsx` | Header + overview |
| `src/lib/mctb/texml-ingress/provision.ts` | `routePhoneToMctbCallHandlingIngress` (non-destructive) |
| `src/lib/voice/agent-service.ts` | Publish/save ingress gate |
| `src/app/api/solutions/appointment-receptionist/route.ts` | Initial handler + mode respect |

**Tests / docs**

| File | Change |
|------|--------|
| `scripts/test-call-handling-ownership.ts` | Topology + SMS proof + publish gate tests |
| `docs/CALL-HANDLING-NUMBER-TOPOLOGY-AUDIT.md` | Read-only topology audit |
| `docs/CALL-HANDLING-OWNERSHIP-SWITCH-IMPLEMENTATION-REPORT.md` | Original report |
| `docs/CALL-HANDLING-OWNERSHIP-SWITCH-IMPLEMENTATION-REPORT-V2.md` | This document |

---

## 2. How `voiceIngressPhoneNumberId` is resolved

`resolveCanonicalVoiceIngressPhoneNumberId()` (`resolve-canonical-voice-ingress.ts`):

1. Explicit override if workspace-owned.
2. Else `loadMissedCallTextConfig(workspaceId).phoneNumberId` (MCTB voice / forwarding DID — **not** `smsPhoneNumberId`).
3. Else `getProductionMctbForwardTargetE164` → lookup `PhoneNumber` by E.164.

This is the single DID whose Telnyx `connection_id` Call Handling mutates.

---

## 3. Where it is persisted

On the **canonical ingress** `PhoneNumber` row:

`settingsJson.callHandling`:

- `activeCallHandler`: `mctb` | `ai_receptionist`
- `parkedAiReceptionistAgentId`
- `explicitSelectionAt`, `lastSwitchAt`, `lastSwitchByUserId`

No new DB migration. MCTB SMS sender remains in `missedCallTextConfig` (`phoneNumberId`, `smsPhoneNumberId`).

---

## 4. How AI agent is resolved independently

`resolveAiReceptionistForCallHandling()`:

- Prefers `parkedAiReceptionistAgentId` when valid published appointment receptionist.
- Else newest published ACTIVE appointment receptionist in workspace.
- Returns `agentId` + `aiVoicePhoneNumberId` (`voiceAgent.phoneNumberId`) **without** requiring equality to ingress.

AI switch routes **ingress** via `routePhoneToVoiceV3BasicCallControl` only; it does **not** reassign the agent to the ingress DID.

---

## 5. How a separate AI DID is preserved

- Removed `syncVoiceAgentPhoneAssignment` from `set-active-call-handler.ts` (static test enforced).
- `parkedAiReceptionistAgentId` updated on AI switch; preserved when switching to MCTB.
- Publish gate skips ingress Telnyx repoint when explicit **MCTB** owns ingress and publish targets that DID (`computePublishSkipIngressRouting`).

---

## 6. How platform / customer SMS sender is resolved (read-only trace)

**Production recovery send path (unchanged in this PR):**

`send.ts` / `customer-sms.ts` → `resolveMctbOutboundSmsRoute` →

1. `resolveMctbSmsSender` (primary: `config.phoneNumberId`)
2. If `smsPhoneNumberId !== phoneNumberId`, append second candidate from `smsPhoneNumberId`
3. First candidate passing `isPhoneAuthorizedForOutboundSms` wins

`resolvePlatformTelnyxSmsRoute` is only used from the **retired** platform-demo branch; `resolvePlatformDemoSmsSender()` currently returns **null** (`platform-demo.ts`). Free-plan “platform sender” in production is modeled as a **separate authorized** `smsPhoneNumberId`, not the ingress toll-free.

Helpers: `listMctbOutboundSmsSenderCandidates`, `pickMctbOutboundSmsSenderCandidate` in `outbound-sms-route-proof.ts`.

---

## 7. Proof Call Handling never changes SMS sender

- `set-active-call-handler.ts` only PATCHes Telnyx on ingress + updates `settingsJson.callHandling`.
- Static test: no `smsPhoneNumberId`, `resolveMctbOutboundSmsRoute`, or `missedCallTextConfig` mutations in that module.
- No changes to `outbound-sms-route.ts`, `sms-sender.ts`, or MCTB send pipeline in this update.

---

## 8. Proof platform / split sender wins when configured

**Topology C/E (unit):** With `phoneNumberId = ingress A`, `smsPhoneNumberId = platform C`, candidate list is `[A, C]`. When only `C` is authorized, `pickMctbOutboundSmsSenderCandidate` selects `C` — mirroring production loop in `resolveMctbOutboundSmsRoute`.

**When ingress A is also authorized:** production would prefer A (first candidate). Product must either keep ingress unauthorized for SMS or set `smsPhoneNumberId` as sole authorized sender — existing MCTB setup behavior, not altered here.

---

## 9. SMS defect discovered?

**No change required for Call Handling** if split-sender config is used (`smsPhoneNumberId !== phoneNumberId` + authorization on platform/customer sender).

**Documented limitation:** `resolveMctbSmsSender` still lists `phoneNumberId` first; there is no separate “platform mode” flag in outbound route beyond demo/cert flags (empty). Relying on `resolvePlatformTelnyxSmsRoute` for free tier is **not** active while platform-demo resolvers return null. If product assigns platform sender only via `smsPhoneNumberId` with ingress unauthorized for SMS, behavior is correct.

---

## 10–14. Topology test results (`npx tsx scripts/test-call-handling-ownership.ts`)

| Scenario | Result |
|----------|--------|
| **A. Shared DID** | PASS — ingress resolver + switch uses ingress only; no agent phone reassignment |
| **B. Separate AI DID** | PASS — `resolve-ai-receptionist` exposes `aiVoicePhoneNumberId`; switch does not call `syncVoiceAgentPhoneAssignment` |
| **C. Platform sender** | PASS — candidate pick prefers authorized `sms_phone_number_id` when ingress not authorized |
| **D. Customer collapsed sender** | PASS — single candidate when ids equal |
| **E. Split sender A/C** | PASS — two candidates; authorized C wins; switch module does not reference SMS ids |

---

## 15. AI → MCTB → AI preservation

**Design:** `parkedAiReceptionistAgentId` + no agent/DID teardown on MCTB route (`routePhoneToMctbCallHandlingIngress` vs destructive `switchDidToMctbTexmlIngress`).

**Automated:** settings merge tests + static guards. **Not run:** full DB integration cycle in this pass.

---

## 16. Publish-while-MCTB-active

**PASS** — `computePublishSkipIngressRouting({ mctb, targetsIngress: true }) === true`; wired through `getCallHandlingPublishPolicy` → `agent-service.ts` publish path.

---

## 17. Provider resource changed by a switch

Exactly one Telnyx **phone number** resource: canonical ingress `providerNumberId`, field **`connection_id`**:

- **→ MCTB:** MCTB TeXML ingress connection (via `routePhoneToMctbCallHandlingIngress`)
- **→ AI:** Voice V3 Basic Call Control app id (via `routePhoneToVoiceV3BasicCallControl`)

CFNA on the customer’s business line is **not** modified.

---

## 18. Runtimes not internally modified

**Confirmed:** No edits to frozen MCTB TeXML entry, eligibility, SMS dispatch jobs, consent runtime, or Voice V3 LiveKit/GPT-Live/webhook/PSTN handlers. Changes are orchestration, settings, publish gates, UI, and non-destructive MCTB ingress helper.

---

## Remaining live PSTN tests (required before merge/deploy)

1. Forward to ingress DID → switch MCTB ↔ AI → verify `connection_id` and answered path (MCTB press-1 / existing consent + V3 Basic).
2. Platform-sender workspace: missed call → recovery SMS **from** platform/customer sender E.164 (not ingress if split).
3. Separate AI DID: after AI→MCTB→AI, agent still on original DID; ingress toggles only.
4. Publish AI while explicit MCTB: ingress stays on TeXML.
5. `npm run verify:mctb-final-pipeline` on certified workspace (environment-dependent).

---

## Test command

```bash
npx tsx scripts/test-call-handling-ownership.ts
```

**Result:** PASS (this update).
