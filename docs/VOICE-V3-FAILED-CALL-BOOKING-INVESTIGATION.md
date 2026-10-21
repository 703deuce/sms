# Failed PSTN booking call — investigation template

**Example call (Oct 2026):** `lk_transovo-call-_+15714776175_MttBqq5Q2cCo`  
**Reported:** Ava said the appointment was booked; **no** `set_scheduling_preference` / `find_availability` / `book_appointment`; `appointmentBooked: false`.

Run on a machine with `DATABASE_URL`:

```bash
CALL_ID=lk_transovo-call-_+15714776175_MttBqq5Q2cCo \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx new-app/scripts/diagnose-voice-v3-call-booking.ts
```

Forensics event **`VOICE_V3_SESSION_TOOL_SURFACE`** (after fix) records:

- `runtime_profile`, `conversational_ivr`
- `published_tool_names` vs `schema_tool_names`
- `booking_tools_present`

---

## Failure modes (mutually exclusive — determine from evidence)

| Mode | Evidence | Fix area |
|------|----------|----------|
| **A. No delegation** | No `voiceToolExecution` rows until caller challenges; Amy TTS offers times | GPT-Live delegation behavior; optional live recovery text from runtime (not prompt rewrites) |
| **B. Tools not on session** | `schema_tool_names` lacks `book_appointment`; `conversational_ivr: true` on a line that should be Full Receptionist | Publish `runtimeProfile`; **runtime profile coalesce** (`withRuntimeProfileFromEditor`) |
| **C. Tools on session, Luna skipped chain** | Booking tools in `schema_tool_names`; only `update_intake` executed | Delegation model tool choice; cross-tool rules already golden — check hydration + scheduling state |
| **D. Book ran, Graph failed** | `book_appointment` execution failed; Amy still confirmed | `book-dispatch` / provider (same file size as monolith — no simplified executor in repo) |

---

## Oct 2026 call — working hypothesis (pending DB confirm)

From transcript/forensics summary in agent thread:

- **Only `update_intake`** in tool trace → **not** mode B alone (intake tools can run in IVR via merged intake helpers).
- Spoken booking **before** calendar tools → **Mode A** primary (Amy answered without delegating SET/FIND/BOOK).
- **Mode B risk:** `isConversationalIvrRuntime` previously treated **missing** `runtimeProfile` as IVR, which could **strip booking tools from catalog** while `published_tool_names` still listed booking — **fixed** by coalescing profile from editor and requiring explicit `conversational_ivr` for the four-tool allowlist.

---

## Code fixes (this branch)

1. **Runtime profile coalesce** — `runtime-profile.ts`, `bundle-voice-config.ts`, `resolve-livekit-session.ts`
2. **LiveKit intake tool merge** — golden parity for `toolSchemas` / `intakeFields`
3. **Session forensics** — `VOICE_V3_SESSION_TOOL_SURFACE`
4. **No booking executor simplification** — `book-dispatch.ts` byte-identical monolith ↔ new-app

**Not done here:** PSTN re-test; production DB forensics for the example `CALL_ID`.

---

## Full Receptionist booking chain (acceptance)

Caller requests appointment → delegation → `set_scheduling_preference` (when needed) → `find_availability` → caller selects slot → `book_appointment` → Graph 201 → `appointmentBooked: true` → Amy confirms.
