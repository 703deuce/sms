# OpenAI Live (GPT-Live-1) — isolated PSTN test pipeline

**Purpose:** Tune **when Amy is allowed to speak** on GPT-Live before wiring booking delegation. Not Microsoft FIND/BOOK, not Voice V2 tool orchestration.

**Single transport:** `openai_live` only. Protocol wiring is **`live-minimal-bridge.ts`** (diagnostic baseline); `live-call-bridge.ts` is a thin Telnyx entry. Legacy transport file values `openai_live_minimal`, `live_minimal`, and `minimal` alias to `openai_live` in `flags.ts`.

**Runtime switch:** `VOICE_AI_TRANSPORT=openai_live`, repo `.voice_ai_transport`, or `/app/.voice_ai_transport`.

**Speech copy / baselines:** `live-frontend-instructions.ts` + `live-config.ts` — env **`OPENAI_LIVE_BASELINE`** (default **G**).

**Test-only server update (no master deploy):** `./scripts/prod-voice-bridge-hotpatch.sh --config-only` or `--live`

---

## Protocol baseline (bridge behavior)

One path in `live-minimal-bridge.ts` (via `openai_live` transport):

1. `session.start` (model + PCMU 8 kHz + optional instructions per baseline)
2. `session.started`
3. **Inbound-only** Telnyx media → `session.input_audio.append` (drops outbound track to avoid self-echo loops)
4. `session.output_audio.delta` → Telnyx

**Not sent after start:** `response.create`, scripted greeting via `session.instructions.append` / `session.commentary.append`, tools, or delegation.

Grep logs: `LIVE_OUT`, `LIVE_IN`, `LIVE_STATS`, `[telnyx] stream started`.

Verify baseline file: `./scripts/verify-live-baseline-forbidden.sh`

---

## Baselines A–D (one transport, env only)

| Baseline | `OPENAI_LIVE_BASELINE` | Instructions |
|----------|------------------------|--------------|
| **G** (default) | `G` | Greeting preamble + full behavioral Live frontend (`OPENAI_LIVE_FRONTEND_BEHAVIOR_INSTRUCTIONS`) |
| **A** | `A` | None — caller speaks first (diagnostic) |
| **B** | `B` | `You are a helpful phone assistant.` (no scripted greet) |
| **C** | `C` | B + short one-question rule |
| **D** | `D` | Previous long conversational frontend (prompt tuning only after A–C pass) |

Do not add a second Live bridge file for “minimal” — change baseline on the container instead.

`OPENAI_LIVE_GREETING_LINE` is **deprecated** for baseline A (no auto-greeting from the app).

---

## Why Live is different from Realtime

GPT-Live **continuously** decides many times per second whether to speak, listen, pause, interrupt, or acknowledge. It is **not** rigid user-turn → assistant-turn.

The public Live session API does **not** expose Realtime-style VAD knobs (`threshold`, `silence_duration_ms`, `semantic_vad` eagerness, etc.). Shape tone, pace, and **when to talk** through **`session.start` instructions** only (baselines B–D). Do not invent VAD parameters for Live in the bridge.

---

## Technical defaults

| Setting | Value |
|---------|--------|
| Model | `gpt-live-1` |
| Audio | `audio/pcmu` @ 8000 Hz (Telnyx μ-law pass-through) |
| Voice | `marin` (or env `OPENAI_LIVE_VOICE`) |

---

## Primary manual test (baseline A first)

With `openai_live` and default **`OPENAI_LIVE_BASELINE=G`**:

1. Call the test DID → Amy should greet within a few seconds (no need to say hello first).
2. Stay silent after the greeting → she should **not** keep talking.
3. Respond briefly → natural reply, then listen again.

For silence / echo diagnostics, set **`OPENAI_LIVE_BASELINE=A`** (caller speaks first).

---

## Long silence / “Are you still there?”

Do **not** ask Live to decide when silence is “too long.”

**Future app rule (not in prompt yet):** after Amy asks a question, start a server timer (e.g. 12s); if no caller audio, inject one instruction: briefly check if the caller is still on the line — **once**.

---

## Extended matrix (before booking / delegation)

| # | Scenario |
|---|----------|
| 1 | Music in the room while you talk |
| 2 | TV running in the background |
| 3 | Someone else talks near you without addressing Amy |
| 4 | Talk to another person mid-call, then return to Amy |
| 5 | Cough while Amy is talking |
| 6 | Dog barks |
| 7 | Pause 1–2s mid-sentence — Amy keeps listening |
| 8 | Interrupt Amy mid-sentence — she yields |
| 9 | “Tuesday—actually no, Wednesday” while interrupting |
| 10 | Several details in one breath |
| 11 | Long silence — one check-in at most, not repeated prompts |

---

## Cursor rules

1. Edit baselines in **`live-config.ts`** (`buildOpenAiLiveSessionInstructions`) — not `instructions.ts` (Realtime/V2) unless switching transport to `openai_realtime`.
2. No Realtime VAD env vars for Live.
3. Hot-patch: `--config-only` for Live bridge + config; `--live` sets transport file to `openai_live`.
4. Keep Realtime booking on `openai_realtime` only; extend Live via baselines, not a second transport.
