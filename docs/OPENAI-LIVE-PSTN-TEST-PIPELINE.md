# OpenAI Live (GPT-Live-1) — isolated PSTN test pipeline

**Purpose:** Tune **when Amy is allowed to speak** on GPT-Live before wiring booking delegation. Not Microsoft FIND/BOOK, not Voice V2 tool orchestration.

**Single transport:** `openai_live` only. Protocol wiring is **`live-minimal-bridge.ts`** (diagnostic baseline); `live-call-bridge.ts` is a thin Telnyx entry. Legacy transport file values `openai_live_minimal`, `live_minimal`, and `minimal` alias to `openai_live` in `flags.ts`.

**Runtime switch:** `VOICE_AI_TRANSPORT=openai_live`, repo `.voice_ai_transport`, or `/app/.voice_ai_transport`.

**Speech copy / baselines:** `src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts` — env **`OPENAI_LIVE_BASELINE`** (default **A**).

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
| **A** (default) | `A` | None — caller speaks first |
| **B** | `B` | `You are a helpful phone assistant.` (first conversational test after A) |
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

With `openai_live` and **`OPENAI_LIVE_BASELINE=A`**:

1. Call the test DID; **stay silent ~10s** → Amy should **not** speak (no greeting, no echo loop).
2. Say “Hello” → brief natural reply.
3. Stay silent again ~10s → **nothing**.
4. Optional: interrupt while she talks → should yield.

Only after A passes, set `B`, then `C`, then `D` for frontend copy experiments.

---

## Long silence / “Are you still there?”

Do **not** ask Live to decide when silence is “too long.”

**Future app rule (not in prompt yet):** after Amy asks a question, start a server timer (e.g. 12s); if no caller audio, inject one instruction: briefly check if the caller is still on the line — **once**.

---

## Extended matrix (after primary test)

| # | Scenario |
|---|----------|
| 1 | Music / TV / dog / cough — no response |
| 2 | Someone else talks nearby — wait |
| 3 | Mid-sentence pause 1–2s — keep listening |
| 4 | Interrupt + self-correct (“Tuesday—no, Wednesday”) |
| 5 | Several facts in one breath — remember, don’t re-ask |

---

## Cursor rules

1. Edit baselines in **`live-config.ts`** (`buildOpenAiLiveSessionInstructions`) — not `instructions.ts` (Realtime/V2) unless switching transport to `openai_realtime`.
2. No Realtime VAD env vars for Live.
3. Hot-patch: `--config-only` for Live bridge + config; `--live` sets transport file to `openai_live`.
4. Keep Realtime booking on `openai_realtime` only; extend Live via baselines, not a second transport.
