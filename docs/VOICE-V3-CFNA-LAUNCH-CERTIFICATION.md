# Voice V3 — CFNA after-hours launch certification

## Ingress model (CFNA)

| Layer | Owner |
|-------|--------|
| Customer calls business number | Carrier / PBX |
| Business line ring duration | Carrier CFNA / no-answer settings |
| Forward to Transovo DID | Customer configures CFNA |
| DID → workspace/agent | `resolveAgentByCalledNumber` + published Voice V3 config |
| AI answers | LiveKit SIP → `resolve_voice_v3_livekit_session` → GPT-Live |

**Customer setup (wizard Phone step):** pick Transovo number, follow carrier CFNA instructions (existing copy in `phone-step.tsx`).

**Transovo setup:** assign DID, LiveKit SIP ingress, publish agent.

**Evidence (code):** `src/lib/telephony/provisioning/agent-routing.ts`, `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`.

PSTN evidence: manual call to business line → CFNA → forwarded DID (not automated in CI).

## Deferred UI (after_hours preset)

Hidden on standard launch wizard — not deleted from schema:

- `answerWhen`, `ringBehavior`, `ringTeamSeconds`
- `detectVoicemailOnTransfer`

Classification: `DEFERRED_NOT_EXPOSED`.

## Transfer

| Item | Path | Cert |
|------|------|------|
| Cold (DIRECT) | Wizard → `compileVoiceV3TransferPolicyFromWizard` → `authorizeVoiceV3Transfer` → `transfer_executor._direct_transfer` (SIP REFER) | `npm run test:voice-v3-transfer-cold-warm-cert` |
| Warm (WARM) | Same → `transfer_executor._warm_transfer` (`WarmTransferTask` + handoff) | Same script; publish requires outbound SIP trunk |
| Waterfall | `transferRouting: waterfall` → multiple authorized targets → executor loop | Same script |
| Transfer timeout | Per-step `timeoutSeconds` / `ringing_timeout_seconds` on transfer attempt — **not** `ringTeamSeconds` | `scripts/test-voice-v3-transfer-system.ts` |
| Fallback | `transferFallback` → compiled route fallback | transfer-system test |

## Appointment required fields

`getMissingFieldsForOperation("book_appointment")` merges active service `requiredIntakeKeys`.

Test: `npm run test:voice-v3-required-fields-book-gate`.
