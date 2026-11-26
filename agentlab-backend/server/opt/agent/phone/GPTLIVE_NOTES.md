# GPT-Live: how it is meant to be used, and where AgentLab's phone line differed

Read 2026-11-25 (ET). Primary sources (OpenAI):
- Getting started: https://developers.openai.com/api/docs/guides/live
- Prompting GPT-Live: https://developers.openai.com/api/docs/guides/live-prompting
- Delegation and tools: https://developers.openai.com/api/docs/guides/live-delegation
- Managing sessions: https://developers.openai.com/api/docs/guides/live-conversations
- Migrate to GPT-Live: https://developers.openai.com/api/docs/guides/live-migration
- Voice agents (measure latency): https://developers.openai.com/api/docs/guides/voice-agents
- Cost: https://developers.openai.com/api/docs/guides/voice-latency-cost
- Telephony and SIP: https://developers.openai.com/api/docs/guides/voice-sip
- Decisions: https://developers.openai.com/api/docs/guides/decisions-voice
- Live API reference: https://developers.openai.com/api/reference/resources/live
- Worked examples: OpenAI Live Console (github.com/openai/openai-live-console, server/protocol.ts);
  Cookbook "GPT-Live evaluation guide" restaurant agent (examples/audio/duplex_voice_agent_evaluation, frontend/prompts/voice.txt,
  responses/prompts/backend.txt); Cookbook "Build a voice agent that follows an SOP" (examples/audio/sop_voice_workflows/delivery/live_prompt.txt).
Secondary: LiveKit GPT-Live plugin docs https://docs.livekit.io/agents/models/realtime/plugins/gpt-live and plugin source
(livekit/agents/llm/_realtime/gpt_live.py, duplex_adapter.py; LiveKit Agents 1.8.13).

## 1. Turn-taking speed is not a setting
- pydantic-ai docs for OpenAI Live: "Live has no turn-detection, truncation, token-limit, or temperature controls: it owns turn-taking entirely."
- LiveKit: "The model controls turn detection and barge-in ... The LiveKit turn detection options can't change that."
- Live reference: the only VAD knob is `wake_policy.vad_threshold` ("Starts inference when microphone speech is detected"), i.e. waking, not end of turn.
- Prompting guide, Patience: "Patience is about when to respond, not just speaking slowly." So reply timing is steered by the PROMPT.

## 2. Recommended Live prompt shape (prompting guide)
"Use `session.instructions` for the assistant's role, speaking style, and when to ask the backend for help. Give the backend model or agent
the procedures and tools." Template headings to keep: `Backchannel policy`, `Interruption policy`, `Delegation policy`.
> "For `gpt-live-1`, replace "Delegate to the backend" with `Generate <|SpawnThinking|>` and "Do not delegate" with `Do not generate <|SpawnThinking|>`."
Template delegation block (booking assistant):
```
Delegation policy:
Backend tools:
- Appointments: check available times and create, change, or cancel bookings.
Delegate to the backend when:
- The user asks for availability or wants to create, change, or cancel a booking.
- A correction changes a booking task already in progress.
Do not delegate when:
- The user greets you or asks you to repeat a result already provided.
- You cannot tell what they are asking for without a brief clarification.
Delegate to the backend before giving an answer that depends on backend work.
Do not guess the result while waiting.
```
Migration guide: "Live needs to know what the backend can do ... Describe those capabilities in plain language. Function names and tool
schemas belong in the backend." LiveKit: "The voice model doesn't see the tools, so don't describe them in the persona."
Response length: "For routine questions, give one or two short sentences."
Interruption ("Immediate stop" recipe): "When the user interrupts, stop speaking right away ... Listen until they finish, then respond to what they said."
Tool-call personality ("Concise · brief receipt, then quiet"): "At the start say only 'Okay, looking it up.' Then remain silent while the backend searches ... When the verified result arrives, ... state [it] in one short sentence."
Silence/noise: "Keep listening while the user pauses to think. Do not treat a cough, music, or nearby conversation as a new request."
Unclear values: "If an important name, date, or number is unclear, ask about that part. Use the user's correction. Do not guess the missing value."
Reuse: "Use a previous backend result when it still answers the question."

Worked example prompts (OpenAI):
- Live Console front end (5 lines): "Keep spoken replies brief. Listen when the user adds details. Delegate every request about products, prices,
  specifications, or recommendations to the backend. Do not invent catalog facts ... Use backend results to answer the user's question."
- Cookbook restaurant (phone booking, closest to us): "Answer provided hours and parking questions without delegating ... If a reservation guest
  name or time is missing ... ask for the missing information without delegating ... Delegate an authorized availability, creation, or cancellation
  request to the application-owned backend and relay only its completed, verified result. Do not reveal tool names."
  Backend: "Call create_reservation only when the legitimate conversation supplies the guest name, date, time, and party size ... Relay the actual completed tool result accurately and concisely to the voice frontend."
  Greeting (developer message at startup): "Greet the caller immediately using the message below. Do not wait for the caller to speak first. After the greeting, pause and listen."
- Cookbook SOP (Blossom): "Speak naturally, briefly, and in your own voice. Let the caller interrupt. Hand off order questions, damage descriptions ... to the backend. Pass the caller's question or correction in full ... Never ... say an action succeeded before the backend has a receipt. Don't read internal tool names."

## 3. Acknowledgements, thinking, commentary
- Live reference (`delegation.acknowledgement_delay_ms`, Responses and client): "Milliseconds to wait before requesting an automatic spoken
  acknowledgement for a delegation ... Any commentary or thinking appended to the session cancels all pending acknowledgements, including those for
  other delegations. Defaults to 400 for Decisions sessions and 0 (request immediately) for other sessions."
- Delegation guide: "A spoken promise such as "I'm checking that" does not confirm that backend work has started."
- thinking = silent context; commentary = "information the model should speak aloud"; each ≤500 tokens. "Large context updates can increase
  hallucinations, so summarize structured data such as JSON or Markdown tables before sending it."
- LiveKit: `generate_reply()` "appends your instruction as commentary".

## 4. Backend latency (delegation guide)
"`service_tier: "priority"`" (Fast mode) for latency-sensitive calls; "reasoning.effort ... Use lower reasoning effort when it completes the task
reliably"; "Return each required tool result promptly"; "Keep answers concise ... Avoid ... extra model calls just to rewrite results for speech";
"React to transcript fragments ... start a speculative lookup when enough information is available".

## 5. Measuring
Voice agents guide: "Measure how long callers wait for a useful spoken answer ... compare the median and 95th percentile ... Measure acknowledgments
such as "I'm checking" separately from the answer the caller needs."

## 6. What we did differently (and the fix)
| # | Ours (before) | Docs | Change |
|---|---|---|---|
| 1 | Live prompt ~1,600 tokens, written like a turn-based agent: tool names (check_availability, book_appointment, transfer_call, end_call ...), argument rules, booking procedure | Short persona + Backchannel/Interruption/Delegation policies; capabilities in plain language; tool names and procedures in the backend | Rewrote the Live prompt in the template shape; moved procedures and tool names to the backend prompt |
| 2 | Said "delegate"/"call X" to gpt-live-1 | gpt-live-1 needs `Generate <\|SpawnThinking\|>` / `Do not generate <\|SpawnThinking\|>` | Use the token wording when the model is gpt-live-1 (plain "Delegate" for 1.1+) |
| 3 | No explicit reply-timing wording; "one or two sentences" only | Timing comes from the prompt (patience/interruption recipes) | Added: reply as soon as the caller finishes, lead with the answer in a short first sentence, no preamble; keep listening through short pauses |
| 4 | Our own filler (`with_filler` → `generate_reply` = commentary at 1.5 s) on top of Live's automatic acknowledgement (requested immediately) | Ack is automatic; commentary/thinking cancel pending acks | Raised our filler to 4 s (only for a truly slow tool) so it never competes with the automatic acknowledgement; prompt uses the "brief receipt, then quiet" pattern |
| 5 | CALL STATE thinking appended after each utterance, mid-delegation possible; includes a JSON blob for other people | Thinking cancels pending acks; summarize JSON as natural language | Defer state injection until the delegation's first audio (≤1.5 s); others summarized in plain words |
| 6 | Backend reasoning "none", service_tier unset | priority tier = fast mode (costs more) | Left default tier (no new spending); noted as an option for John |
| 7 | Greeting via `generate_reply` (commentary) | Developer message in `session.input` is "best results" for greeting first | Kept (greeting works 100% in tests); noted |
| 8 | No VAD passed to AgentSession | LiveKit: "Barge-in needs a VAD ... Without a VAD, the agent plays until the model stops on its own." | Noted; the model still yields on its own (interrupt test passes). Not changed now |
| 9 | Model gpt-live-1 | Docs' template is for gpt-live-1.1 | Not switched without John's OK (different model); noted |

## Changes approved by John (image 25)
1. **Voice model `gpt-live-1.1`** (`models.voice`); `_spawn()` therefore uses the plain template wording "Delegate to the backend when … / Do not delegate when …" (the `<|SpawnThinking|>` token wording is only for gpt-live-1).
2. **Manual filler removed entirely** (`ctx.with_filler` / `generate_reply(FILLER)` deleted from `timed`). Live's automatic delegation acknowledgement covers it. `session.delegation.acknowledgement_delay_ms = 0` is sent explicitly in `session.start` (reference: "0 (request immediately)" is the default for responses delegation). The LiveKit plugin's `types.Delegation` has no such field, so `GPTLiveSession._session_start_event` is wrapped to return a dict with the field added (`_ws_send` accepts dicts). Env `PHONE_ACK_DELAY_MS` overrides.
3. **Greeting as a developer message in `session.input`**: the Agent's `chat_ctx` carries a developer message ("Greet the caller now … Say: "<greeting>" … pause and listen"); the plugin renders it into `session.start.input`. `on_enter` only falls back to `generate_reply` if no agent speech within 5 s. Recorded per call as `greeting_via` / `greeting_s` in `cost_note`.
4. **VAD for barge-in**: local Silero VAD (CPU, no service, no cost) passed to `AgentSession(vad=…)`, per LiveKit "Barge-in needs a VAD … Pass one explicitly, because the session drops its default VAD for this model." `PHONE_VAD=off` disables.
5. **Not changed**: `service_tier` priority stays unset (new spending, not approved).

## A/B result and decision (Nov 25–26, 2026)
Caller-side latency (end of AI-caller speech → agent audio; includes ~0.7 s test-loop overhead):

| Run | Setup | Turns | p50 | p95 |
|---|---|---|---|---|
| img22 | gpt-live-1, old prompt, filler, no VAD | 35 | 2.09 | 5.10 |
| img24 | gpt-live-1, new prompt, filler, no VAD | 21 | 1.93 | 2.38 |
| img25 | gpt-live-1.1, no filler, ack 0, dev-msg greeting, VAD | 19 | 2.09 | 2.50 |
| abA | gpt-live-1 + VAD (img25 code) | 27 | 1.98 | 3.53 (one 6.9 s turn in kbq) |
| abB | gpt-live-1.1, VAD off | 11 | 2.16 | 2.89 |

gpt-live-1.1 regressed clearly in conversation quality with our prompts, with or without VAD:
- It stopped mid-sentence ("The Pro plan is…", "I have…", "Thursday"), backchanneled instead of answering, and made callers repeat themselves 4–8 times. kbq and interrupt hit the 330 s time cap; Mike's booking never happened.
- It twice delegated a plain question and the backend picked `end_call` (now blocked by a code guard).

**Decision: keep gpt-live-1 + VAD** (with the plain wording kept for 1.x via `_spawn`), no filler, ack delay 0, developer-message greeting.

Extra fixes found during the A/B:
- `end_call` guard: refuses unless the caller's last words say goodbye or that they're done (or the call is spam). The backend prompt says the same.
- Calendar post-write conflict check counted events that only touched the slot edges, so it reported "just taken" and deleted a good booking. Fixed with an overlap test.
- Graph 429 retry/backoff added. Invites are no longer added for reserved test domains (example.com, .test, .invalid…). Those invites caused Outlook 429s on create and delete.
- Prompt: "When you already know the answer, lead with it…". Also: don't start a sentence about times, prices or results until the backend result arrives. This targets the half-sentence fragments.
