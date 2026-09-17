import {
  OPENAI_LIVE_BACKEND_MODEL,
  OPENAI_LIVE_MODEL_ID,
  OPENAI_LIVE_VOICE,
  isOpenAiLiveDelegationEnabled,
} from "./constants";
import { buildLiveFrontendInstructions } from "./live-frontend-instructions";
import { buildResponsesBackendInstructions } from "./responses-backend-instructions";
import type { LiveResponsesFunctionTool } from "./live-tools";

export type BuildLiveSessionConfigArgs = {
  businessContext?: string;
  greeting?: string;
  callerContext?: string;
  bookingContext?: string;
  runtimeContext?: string;
  tools?: LiveResponsesFunctionTool[];
};

/**
 * OpenAI Live session object (without session.start wrapper).
 * session.instructions ← frontend only; delegation.responses.instructions ← backend only.
 */
export function buildLiveSessionConfig(
  args: BuildLiveSessionConfigArgs = {},
): Record<string, unknown> {
  const session: Record<string, unknown> = {
    model: OPENAI_LIVE_MODEL_ID,
    audio: {
      format: { type: "audio/pcmu", rate: 8000 },
      output: { voice: OPENAI_LIVE_VOICE },
    },
    instructions: buildLiveFrontendInstructions({
      businessContext: args.businessContext,
      greeting: args.greeting,
      callerContext: args.callerContext,
    }),
  };

  if (!isOpenAiLiveDelegationEnabled()) {
    return session;
  }

  const tools = args.tools ?? [];
  session.delegation = {
    type: "responses",
    responses: {
      model: OPENAI_LIVE_BACKEND_MODEL,
      instructions: buildResponsesBackendInstructions({
        businessContext: args.businessContext,
        bookingConfig: args.bookingContext,
        runtimeContext: args.runtimeContext,
      }),
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
    },
  };

  return session;
}
