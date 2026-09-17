# Microsoft 365 certified PSTN booking pipeline (frozen)

**Isolation policy:** `docs/VOICE-V2-CERTIFIED-PIPELINE-ISOLATION-RULE.md` — this directory is a **sealed box**; do not share booking internals with other strategies.

## Authority

- Baseline commit: **`06125f5f`** (`VOICE_V2_KNOWN_GOOD_BASELINE`)
- Source copy: `src/lib/voice-v2/pipelines/microsoft-365-certified/`
- Verification: `npx tsx scripts/verify-microsoft-365-certified-pipeline-frozen.ts`

## Wizard rule

When **bookingStrategy** is **`MICROSOFT_365`**, Telnyx shared tools MUST point at:

- `POST /api/telnyx/voice-v2/find-availability`
- `POST /api/telnyx/voice-v2/book-offered-slot`

Those routes call **only** `executeMicrosoft365CertifiedFindAvailability` / `executeMicrosoft365CertifiedBookOfferedSlot`. No intake gates, qualification, workflow patches, or `certifiedPipeline` flags on the extended executors.

## Other strategies (separate pipelines)

| Strategy | FIND/BOOK webhooks |
|----------|-------------------|
| `CALENDLY` | `/api/telnyx/voice-v2/calendly/find-availability`, `.../book-offered-slot` |
| `SEND_LINK` | `send-booking-link` tool only (no FIND/BOOK) |
| `REQUEST_ONLY` / `NONE` | finalize / intake tools only |

Publish wiring: `ensureVoiceV2SharedToolsForAgent` in `src/lib/voice/telnyx/ensure-voice-v2-shared-tools.ts`.

## Allowed changes without recert

- Voice provider / model / ElevenLabs selection on the assistant (presentation only)
- Wizard copy and non-booking tools

## Recert required

Any edit under `pipelines/microsoft-365-certified/` or the Microsoft 365 Telnyx FIND/BOOK routes.

## Vertical slice (`internal/`)

Booking-critical code from **`06125f5f`** is vendored under `pipelines/microsoft-365-certified/internal/` (calendar Graph, offer store, validation, timezone, workspace config, etc.). Entry FIND/BOOK import **only** `./internal/*` plus `@/lib/db` and `@/lib/supabase/id`.

Audit: `npx tsx scripts/audit-microsoft-365-certified-booking-imports.ts`

Stale/orphan `VoiceAppointment` reconciliation stays **outside** this tree — it may clean data before booking but must not change frozen FIND/BOOK logic.
