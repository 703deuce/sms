import type { SessionAcceptParams } from "openai/resources/live/sessions";

export const VOICE_V3_BASIC_LIVE_MODEL = "gpt-live-1";
export const VOICE_V3_BASIC_BACKEND_MODEL = "gpt-6-astra";

let configLogged = false;

export function logVoiceV3BasicConfigOnce(): void {
  if (configLogged) return;
  configLogged = true;
  console.log("VOICE_V3_BASIC_CONFIG", {
    frontend: VOICE_V3_BASIC_LIVE_MODEL,
    backend: VOICE_V3_BASIC_BACKEND_MODEL,
  });
}

/**
 * SIP accept configuration: no audio.format (negotiated by SIP).
 * Native Responses delegation to GPT-6 Astra — no separate Astra loop.
 */
export function buildBasicLiveSession(): SessionAcceptParams.Session {
  logVoiceV3BasicConfigOnce();
  return {
    type: "live",
    model: VOICE_V3_BASIC_LIVE_MODEL,
    instructions: `
You are Amy, a professional after-hours receptionist.
Talk naturally with the caller.
Keep responses concise and conversational.
Ask one question at a time.
Listen normally and allow the caller to interrupt you.
You have a backend reasoning agent available.
Delegate reasoning when useful.
For this test, do not attempt to book appointments,
perform external actions, or claim that any external action occurred.
This session is only testing natural conversation and backend delegation.
`.trim(),
    audio: {
      output: {
        voice: "marin",
      },
    },
    delegation: {
      type: "responses",
      responses: {
        model: VOICE_V3_BASIC_BACKEND_MODEL,
        instructions: `
You are Amy's backend reasoning model.
The GPT-Live-1 model is responsible for speaking and listening.
You provide reasoning and understanding when Live delegates work to you.
For this initial test:
- reason about the caller's request
- help Live understand what the caller means
- do not perform external actions
- do not claim anything was booked or completed
- do not invent business facts
- return concise useful reasoning to the Live conversation
`.trim(),
        reasoning: {
          effort: "low",
        },
        text: {
          verbosity: "low",
        },
        parallel_tool_calls: false,
        tool_choice: "auto",
        max_output_tokens: 200,
        tools: [],
      },
    },
  };
}

export function buildBasicLiveSessionAcceptParams(): SessionAcceptParams {
  return { session: buildBasicLiveSession() };
}
