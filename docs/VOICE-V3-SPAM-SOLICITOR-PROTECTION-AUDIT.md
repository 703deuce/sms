# Voice V3 — Spam & Solicitor Protection (implementation audit)

## Layer 1 — Telnyx carrier screening

- **Policy mapping:** `BLOCK` → `reject_calls`, `SCREEN` → `flag_calls`, `ALLOW` → `flag_calls` (retain signal; Amy ignores flag).
- **Sync:** `src/lib/voice-v3/spam-protection/sync-telnyx-inbound-screening.ts` — narrow PATCH `/phone_numbers/{id}/voice` with `inbound_call_screening` only.
- **Publish:** `syncVoiceV3SpamProtectionOnPublish` in `publish-sync.ts`; failure rolls back Voice V3 appointment publish (`agent-service.ts`).
- **Legacy:** `spamLikelyPolicy` / `solicitorPolicy` null → no Telnyx mutation (existing agents unchanged until publish sets policy).
- **New wizard defaults:** `BLOCK` + `DECLINE` in `createDefaultWizardState()`.

## Layer 2 — Amy solicitor handling

- **Prompts:** `spam-protection/prompt-sections.ts` → Live (Amy) + Astra hint.
- **Policies:** `DECLINE` | `TAKE_MESSAGE` | `ALLOW` on `VoiceV3AgentConfig.spamProtection`.
- **Billing:** `applyUnwantedSolicitorCustomerBilling` — `billedCostCents: 0`, metadata `customerBillable: false` (provider cost retained).

## LiveKit

- **SIP header:** `X-Telnyx-Call-Screening` → `transovo.telnyx.call_screening` via `ensureTelnyxSpamHeaderMappingOnInboundTrunk` (merge on shared inbound trunk).
- **Runtime:** Python passes screening value to `resolve_voice_v3_livekit_session`; SCREEN sets `suspectedSpamLikely` for prompts.
- **Blocklist:** `VoiceCallerBlock` model; pre-GPT `preCallReject: blocklist` disconnects room without GPT-Live.

## UI

- **Wizard:** `SpamUnwantedCallsEditor` on Call Handling step (`call-handling-step.tsx`).
- **Call detail:** `POST /api/voice/calls/[id]/block-caller`.

## Tests

- `npx tsx scripts/test-voice-v3-spam-solicitor-protection.ts`

## Limitations (V1)

- US/Canada reputation coverage per Telnyx; not universal global spam protection.
- Manual blocklist cannot reject at Telnyx edge (only after SIP/LiveKit ingress).
- Carrier-rejected BLOCK calls may not create `VoiceCall` rows (no fabricated history).
- Real PSTN Spam Likely certification requires provider-flagged test numbers (not mocked header alone).

## ALLOW mode note

`ALLOW` uses Telnyx `flag_calls` (not `disabled`) for observability without conversational spam treatment.
