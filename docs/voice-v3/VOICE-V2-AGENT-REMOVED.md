# Voice V2 booking agent — removed

The **Voice V2 PSTN booking agent** (Telnyx webhook tools, Microsoft certified pipeline under `voice-v2/pipelines`, GPT-Live / Realtime media bridges, and `/api/telnyx/voice-v2/*`) has been **removed from the product**.

## Canonical replacement

**Voice V3 Basic** — PSTN → Telnyx `v3-basic` webhook → OpenAI Live SIP incoming → deterministic FIND / BOOK / reschedule / cancel under `src/lib/voice-v3/`.

See `docs/voice-v3/BOOKING-PIPELINE-RUNTIME-PATH.md`.

## What was deleted

- `src/lib/voice-v2/pipelines/` (Microsoft + Calendly certified executors)
- `src/app/api/telnyx/voice-v2/**`
- `src/app/api/voice-v2/**` (operations / quality studio HTTP APIs tied to V2 booking)
- `src/lib/voice/telnyx/openai-live-bridge/` (V2 control plane)
- V2 booking executors: `book-offered-slot`, `find-availability`, Telnyx tool routes, etc.
- `ensureVoiceV2SharedToolsForAgent` no longer registers booking webhooks on Telnyx assistants

## What remains under `src/lib/voice-v2/` (temporary)

Wizard / receptionist **configuration types** (intake schema, after-hours rules, operating maturity) still live in `voice-v2` paths until migrated to a neutral `voice-receptionist-config` package. These modules **do not** run booking on calls.

## Ops

Do not point production Amy booking numbers at Telnyx assistants that still list legacy `voice-v2` find/book tools. Use **Voice V3 Basic** ingress only.
