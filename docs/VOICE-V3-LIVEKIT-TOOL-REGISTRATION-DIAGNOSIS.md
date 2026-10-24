# Voice V3 LiveKit — tool registration diagnosis (Oct 2026)

**Status:** Read-only diagnosis + description restoration. **Deploy and agent restructuring held** pending architecture directive.

## Symptom

- Web log `VOICE_V3_PROMPT_FINGERPRINT.toolNames` listed **~8** tools (published editor fingerprint).
- Voice worker `voice_v3_session_starting` logged **`toolCount: 6`** and **`amyToolNames: []`**.

## Root causes (not missing send_booking_link / collect_caller_intake)

### 1. Fingerprint ≠ session `toolSchemas`

| Source | What it counts |
|--------|----------------|
| `VOICE_V3_PROMPT_FINGERPRINT.toolNames` | Published runtime fingerprint from editor (includes names like `end_call` and tools not sent to Python) |
| `resolveVoiceV3LiveKitSession` → `toolSchemas` | Editor-enabled catalog tools **minus** `end_call` (native in Python), minus retired intake tools (`update_intake`, `collect_intake_field`, `set_intake_*`) |

For a typical SEND_LINK receptionist, **schema tool count is often 5–6** HTTP-backed tools plus Python-native **`end_call`** (+ optional **FileSearch**) → **`toolCount: 6`** is consistent with **5 schemas + end_call**, not dropped `send_booking_link`.

Forensic event `VOICE_V3_SESSION_TOOL_SURFACE` logs `schema_tool_names` and `schema_tool_count` — use that for session truth, not fingerprint alone.

### 2. Empty `amyToolNames` (logging bug)

`session.py` used `getattr(t, "name", None)` on LiveKit `@function_tool` objects. Those expose **`tool.info.name`**, not `.name`, so logs showed **empty names** even when tools were registered.

**Fix (recommended with next voice deploy):** log via `tool.info.name` and emit `schemaToolNames` from config alongside `toolCount`.

### 3. Model never called tools (John call `7c9666ad5`)

Evidence: **`voiceToolExecution` count = 0**; worker had no `execute_voice_v3_livekit_tool` for the booking attempt. Registration was not the blocker — **tool choice / instructions** were.

Contributing factors (no regex auto-send):

- **`send-booking-link-tool.ts`** used a **one-paragraph stub** when platform-sender consent gate was off (common), instead of `astra-tool-contracts.ts`.
- Amy instructions emphasized delegation/narration vs explicit **call function tool, speak from result**.
- Planner snapshots on caller-turn commit were **not** returned on the held hotfix path (reverted with merge revert `8897e845d`).

## Description regression (Sept-era vs Oct)

**Canonical file:** `new-app/lib/server/voice-v3/tools/astra-tool-contracts.ts` (ported from `src/lib/voice-v3/tools/astra-tool-contracts.ts` at new-app split).

| Tool | Sept ~2025 (`3ab577131` / pre-split) | Before restore (Oct 2026) |
|------|--------------------------------------|---------------------------|
| **send_booking_link** | Single paragraph in contracts; consent wording | Same paragraph in contracts **but** Live path often got **short inline** description when `isSendBookingLinkToolConsentRequired` was false |
| **transfer_call** | One short paragraph | Multi-line bullets (~same length), still **no** structured sections |
| **request_callback** | Full `WHAT / WHEN / WHEN NOT / SUCCESS` sections | Unchanged (reference pattern) |

**Restore (this change):** Full sectioned contracts for Live Amy tools (`send_booking_link`, `transfer_call`, `collect_caller_intake`, `take_message`, `search_business_knowledge`, `end_call`) matching `request_callback` style. Guard: `new-app/scripts/test-voice-v3-amy-live-tool-description-spec.ts`.

## Verification checklist (post-deploy, when approved)

1. `VOICE_V3_SESSION_TOOL_SURFACE.schema_tool_names` includes `send_booking_link` and `collect_caller_intake`.
2. Worker log `schemaToolNames` / fixed `amyToolNames` lists the same HTTP tools.
3. PSTN test call: `voiceToolExecution` row for `send_booking_link` after caller agrees to text.

## Held (per John)

- Planner on caller-turn commit + Python `liveContextEvents` hydration
- Amy direct-tool policy / delegation instruction restructure
- Coolify web + `transovo-voice` deploy
