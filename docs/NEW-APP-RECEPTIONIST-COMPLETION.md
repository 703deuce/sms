# New-App AI Receptionist V3 — native runtime completion

**Branch:** `cursor/ar-v3-greenfield-f350`

## Architecture (final)

- **No monolith bundle** — removed `voice-v3-bridge.ts`, `bundle:voice-v3`, and `voice-v3-runtime.bundle.mjs`.
- **No silent tool fallback** — `execute_voice_v3_livekit_tool` uses `new-app/lib/server/voice-v3/execute-tool.ts` only; missing session or disabled tools return explicit errors.
- **Published config only for SIP** — inbound LiveKit bootstrap loads `VoiceAgentVersion` / `newAppReceptionist` snapshot; unpublishable without `publishedVersionId`.
- **Browser test** — draft or live via `POST /api/receptionist/test/livekit` + `LiveKitBrowserTest` UI (real `livekit-client` connect).

## Native modules

| Area | Path |
|------|------|
| Session resolve | `lib/server/voice-v3/resolve-livekit-session.ts` |
| Tool execution | `lib/server/voice-v3/execute-tool.ts` |
| Publish capability gate | `lib/server/voice-v3/publish-gate.ts` |
| Scheduling | `lib/server/voice-v3/scheduling/*` (Calendly, Microsoft Graph, Google Calendar) |
| Knowledge | `lib/server/voice-v3/knowledge/search.ts` |
| Post-call | `lib/server/voice-v3/post-call/finalize.ts` + `finalize_voice_v3_call` action |
| LiveKit test / verify | `lib/server/voice-v3/livekit/browser-test.ts` |
| Dispatch sync | `lib/server/receptionist/livekit/dispatch-sync.ts` |

## Tools implemented (native)

`update_intake`, `set_scheduling_preference`, `find_availability`, `book_appointment`, `send_booking_link`, `transfer_call`, `request_callback`, `report_unwanted_solicitor`, `business_answer`, `end_call`.

`find_appointment`, `reschedule_appointment`, `cancel_appointment` return explicit `provider_limit` / `not_implemented` until provider-specific lookup/mutation is completed (no fake success).

## Tests run

```bash
cd new-app
pnpm run test:voice-v3
RECEPTIONIST_TEST_BASE_URL=http://127.0.0.1:3100 pnpm run test:receptionist
```

## Remaining live-only validation

- End-to-end PSTN call with Python worker + real calendar OAuth tokens
- LiveKit dispatch rule verification against production Telnyx trunk (requires env + provisioned number)
- Full reschedule/cancel/find-appointment per provider

## UI audit (fixtures removed)

- Knowledge, Analytics, Test — API-backed
- Publish review — no `lib/data` FAQ fixture
- Example script on Test page labeled separately from LiveKit live test
