# Architecture Directive v2 — GPT-Live delegation report

**Date:** 2026-10-24  
**Git target:** `master` @ `51b671755` (feat: GPT-Live delegation v2)  
**PR:** #748 (`cursor/voice-mctb-tool-contracts-9779`, merged to `master`)

---

## 1. Sept ~26 working setup (git evidence)

| Item | Finding | Verification |
|------|---------|--------------|
| Voice surface model | **`gpt-live-1`** via `GPTLiveModel` | `git show 15f8ca951` / `54bffeea3` (`2026-09-24`–`2026-09-28`) `voice-runtime-python/.../session.py` |
| Delegation mode | **`delegation="responses"`** (backend Responses API runs `@function_tool`) | Same commits; LiveKit `gpt-live/README.md`: default for `gpt_live_agent.py` is Responses delegation |
| Backend model | **`gpt-6-luna`** default (`astraModel` from Node `resolve_voice_v3_livekit_session`) | `1691b3863` (2026-09-24) |
| Direct Amy tools | **No** on speaking model — tools on `AgentSession` feed delegated Responses | LiveKit: `client` delegation cannot call framework tools |
| Legacy `gpt-realtime` PSTN | **Not** Voice V3 inbound path | MCTB TeXML / other products only |

**Conclusion:** Working Sept-era calls were **Option A (GPT-Live + Responses delegation)**, not gpt-realtime direct tools on the speaking model.

---

## 2. Tool registration: 8 vs 6 (root cause)

| Count | Source |
|-------|--------|
| **~8** | `VOICE_V3_PROMPT_FINGERPRINT.toolNames` — editor/published catalog (may include disabled names, `end_call`, etc.) |
| **6** | Worker: HTTP `toolSchemas` (often **5** for SEND_LINK receptionist) + native **`end_call`** (+ optional **FileSearch**) |

**Not dropped:** `send_booking_link` and `collect_caller_intake` appear in `schemaToolNames` when SEND_LINK + booking URL are published.  
**Logging bug fixed:** `amyToolNames` used `getattr(t,"name")` on `function_tool` → empty; now `tool.info.name`.

**Session-start evidence (worker):** `voice_v3_gpt_live_session_config` and `voice_v3_session_starting` in `voice-runtime-python/transovo_voice/voice_v3/session.py` log:

- `delegation`, `responsesModel`, `responsesToolChoice`, `backendToolSchemaNames`, `sessionToolRegistrationNames`
- `schemaToolNames`, `sendBookingLinkRegistered`, `collectCallerIntakeRegistered`

**New telemetry:** `voice_v3_responses_validation_failed` on OpenAI server events whose `type` contains validation failure strings.

---

## 3. v2 wiring (steps 3–6)

| Area | Change |
|------|--------|
| **Amy (GPT-Live)** | `gpt-live-amy-instructions.ts` + `live-frontend-instructions.ts` — persona, backend capability policy (**no tool names**), `<|SpawnThinking|>` when / when-not, outcome guardrails |
| **Backend (Luna/Astra)** | `astra-backend-instructions.ts` + full contracts in `astra-tool-contracts.ts`; descriptions guarded by `test-voice-v3-amy-live-tool-description-spec.ts` |
| **Tool results → speech** | `execute-tool.ts` → `buildCommentaryEventsFromToolResult` (`session.commentary.append` from `speech_line`); no `pushAgentSnapshotToLive` on tool path |
| **Delegation hydration** | `push-delegated-runtime-context.ts` — commentary-only, no large thinking snapshots |
| **send_booking_link** | Always full contract; success payload includes `speech_line` + `idempotency_key` |
| **Regex / keyword intent** | Reverted via `8897e845d` (removed `booking-intent-from-transcript` auto-send path) |

**Remaining planner path (differs from “no mid-call instruction swaps” goal):** `afterVoiceV3StateChange` can still emit `session.thinking.append` planner snapshots when a `liveSend` handler is registered on the call runtime (`call-runtime.ts`). Voice V3 LiveKit worker does **not** register that handler today; risk is Node-side bridges that still call `registerLiveContextSend`. **Recommended follow-up:** gate planner snapshot push off LiveKit GPT-Live transport entirely.

---

## 4. Old vs new tool descriptions (excerpt)

### `send_booking_link`

**Old (Oct regression — inline stub):** Short paragraph when platform sender; no structured sections.  
**New:** Full `WHAT / WHEN / WHEN NOT / WHILE / SUCCESS / FAILURE / ARGUMENTS` in `SEND_BOOKING_LINK_TOOL_DESCRIPTION`; `buildSendBookingLinkOpenAiTool` always uses `buildSendBookingLinkToolDescription()`.

### `transfer_call`

**Old (Sept ~`3ab577131`):** Single paragraph.  
**New:** Full sectioned contract (WHEN with phrasing examples, WHEN NOT, WHILE, SUCCESS, FAILURE, ARGUMENTS).

---

## 5. Tests run (this run)

| Check | Result |
|-------|--------|
| `VOICE_V3_AMY_LIVE_TOOL_DESCRIPTION_SPEC` | **PASS** (6 tools, 7 sections each) |
| `pytest test_session_tool_log_names.py` | **PASS** |
| `pytest test_gpt_live_delegation_telemetry.py` | **PASS** (13 tests) |
| LiveKit AgentSession 5×5 (real models) | **BLOCKED** — no `OPENAI_API_KEY` on cloud agent VM; scaffold skips without `TRANSOVO_BACKEND_URL` |
| Option B (gpt-realtime-2.1 direct Amy tools) | **Not prototyped** — do not deploy without approval |

---

## 6. Deploy (Coolify)

| Service | App | Deployment queue | Image / health `commitSha` | Status |
|---------|-----|------------------|----------------------------|--------|
| **Voice worker** | `transovo-voice` (`tgjridm6vrmrgljkfrr0rpjn`) | `3972` **finished** | `tgjridm6vrmrgljkfrr0rpjn:51b671755…` | **On v2** |
| **Web** | `sms:master-ds8s3hjin60qs6g7s0iqkixs` | `3971` **in_progress** (queued `3970`) | Health still `c7f55af4…` (pre-v2 merge) | **Not on v2 yet** — Nixpacks build in progress at last check |

**Disk (Coolify host):** `/` 38% used (~90G free).  
**Queued deploy UUIDs:** web `14yf9cwvb3m09ycksju6syif`, voice `4s5aqtkc0jgsgbdgu4o6zqzc`.

**John PSTN smoke (post web=v2):** SEND_LINK receptionist — book → agree to text **this number** → confirm `voiceToolExecution` for `send_booking_link` and worker log lines `schemaToolNames` / `voice_v3_gpt_live_session_config`.

---

## 7. LiveKit official examples alignment (John addendum)

**Reference sources cloned / read:**

- `github.com/livekit/agents` → `/tmp/livekit-refs/agents` (shallow)
- Company Directory → [LiveKit recipe](https://docs.livekit.io/reference/recipes/company-directory/) (not a top-level folder in `agents` main at this snapshot; recipe code matches docs)
- `livekit-examples/python-agents-examples` cloned (telephony recipes live under `docs/examples/` there; primary diff target is `agents` main `examples/`)

**Target design:** ONE main receptionist agent; LiveKit **tasks** for structured collection; **function tools** for availability/booking/link/message/callback/transfer; Transovo Node persists outcomes; **no** extra coordinator / planner-driven instruction swaps on GPT-Live.

### Mapping table

| LiveKit pattern | Official reference | Transovo file(s) | Match / diff | Change this run |
|-----------------|-------------------|------------------|--------------|-----------------|
| **(a) GPT-Live + Responses delegation** | `examples/voice_agents/gpt-live/gpt_live_agent.py` — voice `instructions` on `Agent`; backend `responses_options.model` + `responses_options.instructions`; `@function_tool` on same agent class, executed by backend when `delegation="responses"` | `voice_v3/session.py` — `Agent(instructions=amyInstructions)`; `GPTLiveModel(..., delegation="responses", responses_options={ model: astraModel, instructions: astraInstructions, tool_choice: auto })`; tools on `AgentSession` | **Matches** official split (persona vs backend instructions). We source both from Node `resolve-livekit-session.ts` instead of inline Python strings. | Already on `51b671755`; voice deployed |
| **(a-alt) Client delegation** | `gpt-live/client_delegation.py` — `delegation="client"`, empty agent tools, `append_commentary` | Not used for V3 inbound | **Intentionally differs** — we stay on Responses delegation per Directive v2 | None |
| **(b) Front desk booking** | `examples/frontdesk/agent.py` — `list_available_slots` → `schedule_appointment(slot_id)` → **`GetEmailTask(chat_ctx=self.chat_ctx)`** inside tool; calendar is system of record | Node: `find_availability` / `book_appointment` + connected calendar adapters; Python: HTTP `client.execute` from `@function_tool` wrappers in `voice_v3/tools.py` | **Matches at backend** (tool result drives speech). **Differs** at surface: Front Desk uses same-model realtime tools; we use GPT-Live delegation so **backend** model chooses tools. Email/intake sub-task pattern analogous to **`GetEmailTask` inside tool** via `collect_caller_intake` → `IntakeTask` | No structural change; keep calendar on Node |
| **(c) Company directory cold transfer** | Recipe: find SIP participant → `TransferSIPParticipant(room, identity, transfer_to)` → REFER; agent keeps helping on failure | `transfer_executor.py` `_direct_transfer` → `api.TransferSIPParticipantRequest`; warm path uses `WarmTransferTask` (healthcare pattern). Node authorizes via `transfer_call` → execution plan | **Matches** REFER shape after removing erroneous `LIVEKIT_EXECUTOR_DISABLED` skip (this run). **Differs:** Phone foundation Telnyx Call Control handoff remains for non–LiveKit-SIP legs | **Fixed** `transfer_executor.py` — `livekit_sip` executor runs `_direct_transfer` / `WarmTransferTask` again |
| **(d) Structured intake TaskGroup** | `examples/survey/agent.py` — `TaskGroup` + `GetEmailTask`; `chat_ctx` passed; structured results | `intake_task.py` — `IntakeTask(AgentTask)` with `chat_ctx=resolve_intake_chat_context(context)`; `run_intake_task` uses `async with context.foreground(): result = await task` (**returns control** to main agent). Legacy `workflows/booking_intake.py` **TaskGroup** still used by older templates, **not** V3 GPT-Live session | **Partial match:** V3 uses **single-tool** `collect_caller_intake` wrapping one `AgentTask` (closer to **Frontdesk `GetEmailTask` inside `schedule_appointment`** than Survey’s full `on_enter` TaskGroup). Prebuilt `GetNameTask` / `GetPhoneNumberTask` via `run_prebuilt_collector_for_field` | Align V3 further by optional TaskGroup only if product needs multi-stage survey flow |

### Specific checks (evidence)

**Functions registered at session start (SEND_LINK-style receptionist):**

- Node sends `toolSchemas` in LiveKit session config (from published catalog).
- Python builds `session_tools` = dynamic `@function_tool` per schema + optional `FileSearch` + `end_call` toolset.
- Logged names: `schemaToolNames`, `sessionToolRegistrationNames` / `amyToolNames` on `voice_v3_session_starting`.

**Voice persona vs backend reasoning instructions:**

| Layer | Field | Built by | Content character |
|-------|-------|----------|-------------------|
| GPT-Live voice | `amyInstructions` | `buildLiveFrontendInstructions` → SpawnThinking, capability policy, business facts, telephony canon | No tool names; delegation triggers |
| Responses backend | `astraInstructions` | `buildAstraBackendInstructions` + tool contracts embedded in OpenAI tool definitions | Tool-choice rules, intake/transfer/booking policies |
| Wire format | `responses_options.instructions` | Set in `session.py` from config payload | Same string as `astraInstructions` |

**Intake tasks return control:**

- `execute_collect_caller_intake` → `run_intake_task` → `IntakeTask` completes with `IntakeTaskResult`; runs under `context.foreground()` so the main GPT-Live session resumes after the sub-task (LiveKit `AgentTask` pattern).

**Telnyx SIP REFER / transfer (API evidence, production web container, 2026-10-24):**

| Connection | ID | `active` | Notes |
|------------|-----|----------|-------|
| Transovo Voice V3 Basic OpenAI Live SIP | `3051306325762901074` | true | Inbound FQDN → LiveKit; codecs G722/G711; `prack_enabled: false`; `confirm_blind_transfer: false` |
| Transovo LiveKit Inbound | `3037959952799893412` | true | Same inbound shape |
| Legacy doc ID `3022029259041408870` | — | **404** | Retired; do not use |

Telnyx FQDN API **does not expose** a simple “enable SIP REFER” boolean on inbound. Outbound REFER for transfers is initiated by **LiveKit** `TransferSIPParticipant` through the SIP trunk/LiveKit Cloud telephony config. **No portal change identified** from API for John — if REFER fails in production, verify **LiveKit SIP trunk outbound** and destination E.164 on the transfer plan, not a missing Telnyx inbound toggle in the payloads above.

---

## 8. Option B / coordinator layers

- **Option B:** Not run; blocked same as 5×5 matrix.
- **Coordinator layers to avoid (status):**
  - **Regex/keyword booking intent** — removed (revert).
  - **Planner `thinking.append` on GPT-Live** — removed from tool execute path; planner snapshot may still run if `liveSend` registered (see §3).
  - **Node `telnyx-transfer-coordinator`** — still used for Phone-foundation Call Control transfers; parallel to LiveKit recipe for LiveKit-native legs.

---

## 9. John single test call (manual)

After **web** health `commitSha` = `51b671755…`:

1. PSTN to SEND_LINK receptionist line.
2. Ask to book → agree to text link to **calling number**.
3. Expect: worker log `send_booking_link` in `schemaToolNames`; DB `voiceToolExecution` row; Amy speech only after backend `speech_line`/commentary confirms send.

---

## Appendix: commands

```bash
# Static Amy tool contracts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx --tsconfig new-app/tsconfig.json \
  new-app/scripts/test-voice-v3-amy-live-tool-description-spec.ts

# Python unit
cd voice-runtime-python && python3 -m pytest tests/test_session_tool_log_names.py tests/test_gpt_live_delegation_telemetry.py -q

# Production health
curl -sS https://transovo.ai/api/health
```
