import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import { z } from "zod";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { schedulingMeaningZodObject } from "../time/scheduling-meaning-schema";
import {
  mergeSchedulingMeaningIntoContext,
  schedulingDisplayPreference,
} from "../intake/merge-scheduling-meaning";
import { mergeDialogActiveGoalFromTool } from "../intake/merge-intake-state";
import { schedulingMeaningHasSignal } from "../time/scheduling-normalizer";
import { SET_SCHEDULING_PREFERENCE_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";

const setSchedulingArgsSchema = schedulingMeaningZodObject;

export type SetSchedulingPreferenceArgs = z.infer<typeof setSchedulingArgsSchema>;

export function buildSetSchedulingPreferenceOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "set_scheduling_preference",
    parameters: setSchedulingArgsSchema,
    description: SET_SCHEDULING_PREFERENCE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const setSchedulingPreferenceTool: VoiceToolDefinition<SetSchedulingPreferenceArgs> = {
  name: "set_scheduling_preference",
  description: "set_scheduling_preference",
  parameters: {},
  validate: (raw) => setSchedulingArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    if (!schedulingMeaningHasSignal(args)) {
      return voiceToolError(
        "INVALID_ARGUMENTS",
        "Scheduling preference must include structured date or time semantics.",
        { hint: "Populate date_relation, weekday, time_kind, daypart, or explicit date/time fields." },
      );
    }

    const snap = ctx.runtime.getSnapshot();
    const merged = mergeSchedulingMeaningIntoContext(snap, args);
    let next = mergeDialogActiveGoalFromTool(merged.context, "BOOK_APPOINTMENT");
    ctx.runtime.replaceContext(next);
    next = ctx.runtime.getSnapshot();

    const clarification = next.scheduling.clarification;
    if (clarification?.required) {
      return voiceToolError(
        "SCHEDULING_CLARIFICATION_REQUIRED",
        "Scheduling needs clarification before searching availability.",
        {
          reason: clarification.reason,
          missing_or_ambiguous: clarification.reason,
          clarification_prompt: clarification.prompt,
        },
        "not_ready",
      );
    }

    const normalized = next.scheduling.normalized;
    if (!normalized || normalized.precision === "UNRESOLVED") {
      return voiceToolError(
        "SCHEDULING_CLARIFICATION_REQUIRED",
        "Could not resolve scheduling preference deterministically.",
        { reason: "SCHEDULING_UNRESOLVED" },
        "not_ready",
      );
    }

    return toolOk("SCHEDULING_PREFERENCE_SET", {
      generation: next.scheduling.generation,
      display_preference: schedulingDisplayPreference(args, normalized),
      ready_for_availability_search: true,
      scheduling_generation_changed: merged.schedulingGenerationChanged,
    });
  },
};
