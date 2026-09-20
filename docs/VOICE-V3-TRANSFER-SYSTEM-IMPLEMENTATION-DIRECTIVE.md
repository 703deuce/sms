# VOICE V3 — TRANSFER SYSTEM IMPLEMENTATION DIRECTIVE

**Status:** Canonical implementation spec for Cursor / engineering (2026-09-20).  
**Companion:** `docs/VOICE-V3-TRANSFER-PREFLIGHT-AUDIT.md` (installed LiveKit 1.8.2 + repo gap analysis).

---

## Objective

Implement the complete Voice V3 transfer capability end-to-end:

1. Direct / cold transfer  
2. Warm / attended transfer  
3. Waterfall transfer  
4. Failure/fallback handling  
5. Wizard configuration  
6. Published config/compiler  
7. Astra FunctionTool contract  
8. Amy conversational behavior  
9. LiveKit physical transfer execution  
10. Telnyx SIP requirements  
11. Persistence/audit/observability  
12. Automated tests  
13. Real PSTN certification  

**Not done** when code compiles only. Done when wizard → publish → PSTN → natural language → correct transfer workflow.

**Preserve architecture:**

```
Telnyx PSTN → LiveKit SIP → AgentSession → GPTLiveModel / Amy
  → delegation=responses → Astra → FunctionTool
  → Transovo authorization/business state → LiveKit transfer primitive → Telnyx/PSTN
```

**REPLACE** plumbing with LiveKit where LiveKit owns it. **KEEP** Transovo business authority. **Do not** reintroduce custom OpenAI websocket, manual delegation, custom telephony engine, or Astra-chosen phone numbers/modes.

---

## 0. Source authority — before editing

Inspect: livekit-agents==1.8.2; LiveKit cold transfer / WarmTransferTask / SIP outbound / Telnyx provider docs; Telnyx external transfer docs; existing `transfer_call`; Voice V3 wizard/compiler; `voice-tool-catalog.ts`; Python FunctionTool adapter.

`WarmTransferTask` is under `livekit.agents.beta.workflows` in docs — **verify installed 1.8.2 API** (see preflight audit). Do not silently recreate WarmTransferTask.

---

## 1. Product model

**One** capability, modes: `DIRECT` | `WARM` | `WATERFALL`.

Astra selects **logical** destination/route ids only (e.g. `emergency_on_call`, `owner`, `front_desk`). Transovo resolves E.164, mode, timeouts, waterfall order, fallback.

**Never** let the LLM supply: arbitrary E.164, SIP URI, trunk IDs, mode override, waterfall order, timeouts, caller-ID config.

---

## 2–8. Modes, warm context, outcomes, waterfall, fallback

- **DIRECT:** LiveKit `TransferSIPParticipant` / SIP REFER; success → caller leaves room; `ringing_timeout` fail → caller stays with Amy (required for waterfall/fallback). Default ringing timeout **30s** (configurable).  
- **WARM:** Native `WarmTransferTask` (if 1.8.2 supports) — private room, outbound SIP, hold, briefing, accept/decline/VM, merge, cleanup. Transovo owns policy; LiveKit owns mechanics.  
- **Warm briefing:** From real conversation state; concise handoff via `extra_instructions` / installed equivalent + `chat_ctx`.  
- **Warm outcomes:** ACCEPTED → `TRANSFER_CONNECTED`; DECLINED / NO ANSWER / TIMEOUT / VOICEMAIL (default: not dump to VM) → fallback.  
- **WATERFALL:** Transovo **sequential** policy over LiveKit primitives — **one** `transfer_call(route_id)` from Astra; Transovo runs target 1 → 2 → …; **stop on first connect**; never parallel dial.  
- **Fallback:** `RETURN_TO_AGENT` | `REQUEST_CALLBACK` | `TAKE_MESSAGE` / `CONTINUE_CONVERSATION` | `END_CALL`.

---

## 9–14. Wizard & published config

Extend existing Transfer capability in Voice V3 wizard (do not create disconnected settings).

Levels: Transfer settings → Destinations → Transfer routes/waterfall.

Publish via `compileVoiceV3AgentConfig` with `transfer: { enabled, defaultRingingTimeoutSeconds, destinations, routes, defaultFallback }`. Activation validation: E.164, non-empty waterfall, enabled destinations, outbound SIP for warm when knowable, etc.

---

## 15–20. Tool surface & authorization

- **Single tool name:** `transfer_call` (no `cold_transfer_call` / `warm_transfer_call` unless LiveKit forces it).  
- **Astra args (logical only):** `route_id`, optional `destination_id`, `reason` — never `phone_number`, `sip_uri`, `mode`.  
- **Waterfall:** Astra calls once per route; Transovo executes all targets.  
- **Split:** Astra = semantic; Transovo = authorize + plan; Python worker = LiveKit execution.  
- **Authorized plan** (conceptual): `transfer_authorized` + `targets[]` with `mode`, `dial_target` (server-only), `ringing_timeout_seconds`, `fallback`.

---

## 21–26. Executors (LiveKit + Telnyx)

- **COLD:** `TransferSIPParticipant` on **PSTN SIP participant identity** (not Amy). `transfer_to` from authorized config + trunk format (`tel:` / `sip:` per audit). Telnyx **REFER enabled** or `TRANSFER_PROVIDER_NOT_CONFIGURED`.  
- **WARM:** Installed `WarmTransferTask` + `LIVEKIT_SIP_OUTBOUND_TRUNK` / `sip_trunk_id`.  
- **WATERFALL:** Loop targets; DIRECT success is terminal (caller left room); WARM failures advance. Structured outcomes: `NO_ANSWER`, `BUSY`, `DECLINED`, `VOICEMAIL`, `TIMEOUT`, `PROVIDER_ERROR`, `CONFIGURATION_ERROR`, `CALLER_GONE`, `CONNECTED`, `transfer_exhausted`.

---

## 27–35. Prompts, hours, cost, persistence, idempotency, interruption, UI validation

- Amy/Astra transfer sections per directive (no tool names/phones in Amy; Astra never claims connected until runtime confirms).  
- Reuse existing schedule infra for route eligibility.  
- AI exits after successful handoff — no permanent conference bridge.  
- Emit `VOICE_V3_TRANSFER_*` telemetry (mask phones; no credentials).  
- WRITE/TRANSFER duplicate reject; no double dial.  
- Caller correction before commit → abandon transfer / callback; no transition matrix.

---

## 36–43. Tests & PSTN certification

Config, direct, warm, waterfall, cross-feature tests as specified. PSTN cert DID **+15717491060** for direct, warm, waterfall scenarios (real calls — do not claim PASS without them).

---

## 44. Do not touch

Microsoft book/find/cancel/reschedule, SEND_LINK, `request_callback`, intake, OfferSets, freshness, idempotency, wizard compiler patterns, GPT-Live delegation, LiveKit lifecycle, `EndCallTool`. No manual Responses coordinator, CallerMeaning, keyword router, etc.

---

## 45–46. Definition of done & implementation report

Done = all three modes wizard → PSTN proven. Report: files changed, preserved `transfer_call`, LiveKit 1.8.2 APIs used, Telnyx config status (no secrets), wizard evidence, tool schema, prompts, tests, PSTN honesty, blockers only.

---

## Governing principle

| Layer | Decides |
|-------|---------|
| LLM | “Caller needs configured emergency route / person.” |
| Transovo | Who is authorized, cold vs warm, waterfall order, timeout, fallback. |
| LiveKit | SIP transfer, warm-transfer workflow, rooms, hold, dial, merge, cleanup. |
| Telnyx | PSTN/SIP transport. |

**One Astra tool (`transfer_call`).** Business published config chooses direct, warm, or waterfall — not the model.

---

## Official references (external)

- LiveKit cold transfer / call forwarding  
- LiveKit `WarmTransferTask`  
- LiveKit warm-transfer guide  
- LiveKit SIP API / `TransferSIPParticipant`  
- LiveKit Telnyx trunk setup  
- Telnyx external call-transfer behavior  
- Telnyx: enable SIP REFER for cold transfer  

---

*For the verbatim long-form directive (all UI copy examples and pseudo-code blocks), use the Cursor task message dated 2026-09-20 or expand this doc in-repo as implementation proceeds.*
