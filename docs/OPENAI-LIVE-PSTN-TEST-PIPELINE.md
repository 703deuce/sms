# OpenAI Live (GPT-Live-1) — isolated PSTN test pipeline

**Purpose:** Evaluate **voice behavior only** (turn-taking, interruptions, background noise, backchannels) on production PSTN via the hot-patched bridge — **not** booking, Microsoft, or Voice V2 tool orchestration.

**Runtime switch:** `VOICE_AI_TRANSPORT=openai_live`, or copy `.voice_ai_transport.example` → `.voice_ai_transport` in the repo root (local), or `/app/.voice_ai_transport` on the server. See `flags.ts`.

**Not a master release:** behavioral prompt changes live in `live-config.ts` on the experiment branch. To try on the running 571 test container without merging `master`, run `./scripts/prod-voice-bridge-hotpatch.sh --config-only` (or `--live` for full bridge files + transport).

**Code paths:**

| Piece | Location |
|--------|-----------|
| Live frontend instructions (session.start) | `src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts` → `OPENAI_LIVE_FRONTEND_INSTRUCTIONS` |
| Bridge (no tools) | `live-call-bridge.ts` |
| Production Realtime (GA) path | `call-bridge.ts` + `flags.ts` → `openai_realtime` |

---

## Why behavioral instructions live on the Live frontend

OpenAI positions **GPT-Live-1** around **when to speak, when not to speak**, interruption handling, thinking pauses, backchannels, and focus in background noise. The **Live API `session.start` instructions** are the right place for that — behavioral, not procedural.

Do **not** put into this Live frontend prompt (yet):

- Booking rules, required-field intake, Microsoft/Graph instructions
- Long business logic or wizard copy

Those belong in **delegation / backend instructions** (`delegation.responses.instructions` in the Live API model) once voice behavior is proven. Keep the Live frontend **compact**.

For the **current isolated test**, there is **no** delegation backend wired — the bridge has **no tools**. The frontend prompt includes an explicit “isolated test” line so Amy does not claim scheduling or account actions.

---

## Tuning after listening (first test pass)

Use the prompt in `live-config.ts` **almost verbatim**, then adjust only:

1. **Pause tolerance** — thinking pauses vs end-of-turn
2. **Response speed** — prompt says *respond promptly after a clearly completed thought*, not “respond instantly”
3. **Interruption aggressiveness** — stop when caller speaks
4. **Backchannel frequency** — mm-hmm / got it / okay

**Wording that matters (from prod trivia call):**

- **Background noise:** Be explicit about what is **not** a turn (TV, music, another person not addressing Amy, dogs, etc.). Live can still react to background speech; instructions steer conservatism.
- **Faster response:** *“Respond promptly after a clearly completed thought. Do not wait unnecessarily. But keep listening through natural thinking pauses.”*
- **Interruptions:** *“If the caller begins speaking while you are talking, stop speaking promptly and listen.”*
- **Caller talks to someone nearby:** Wait; only respond when the caller addresses you again.

---

## Manual PSTN test matrix (before touching real Amy / V2 pipeline)

Run on the **571 (or test) line** with `openai_live` active. One scenario at a time; note call ID and bridge logs.

| # | Scenario |
|---|----------|
| 1 | Music in the room while you talk to Amy |
| 2 | TV running in the background |
| 3 | Someone else talks near you **without** addressing Amy |
| 4 | Say something to another person mid-call, then return to Amy |
| 5 | Cough while Amy is talking |
| 6 | Dog barks |
| 7 | Pause **1–2 seconds** mid-sentence |
| 8 | Interrupt Amy mid-sentence |
| 9 | Change mind while interrupting: “Tuesday—actually no, Wednesday” |
| 10 | Several details in one breath |
| 11 | Stay silent long enough to see if Amy jumps in too aggressively |

**Evidence:** `docker logs` lines with `callId`; DB `voiceCallEvent` type `call.transcription`; metadata `voiceV2PostCallTranscript` after hangup.

---

## Relationship to Voice V2 production

- **Voice V2 one-Amy PSTN booking** remains on Telnyx Assistant / frozen FIND-BOOK path per `docs/VOICE-V2-CLOUD-AGENT-HANDOFF.md`.
- **Live experiment** reuses Telnyx media ingress only; it does **not** replace certified booking runtime until explicitly integrated with Live delegation + tools.

---

## Cursor agent rules (this workstream)

1. Edit **only** `OPENAI_LIVE_FRONTEND_INSTRUCTIONS` in `live-config.ts` for behavioral changes on the test pipeline — not `instructions.ts` (Realtime/V2 loader) unless switching transport back to `openai_realtime`.
2. Do not add booking, Microsoft, or intake blocks to the Live frontend prompt during the throwaway test phase.
3. After prompt changes, hot-patch: `./scripts/prod-voice-bridge-hotpatch.sh --live` and re-run the manual matrix above.
4. Log improvements (optional): persist `session.output_transcript.delta` text in `live-call-bridge.ts` for eval without relying on Telnyx ASR alone.
