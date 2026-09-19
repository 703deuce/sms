import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchFindAvailabilityIfRequired } from "../calendar/find-dispatch";
import {
  mergeDialogActiveGoalFromTool,
  mergeSchedulingNaturalLanguage,
} from "../intake/merge-intake-state";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { FIND_AVAILABILITY_TOOL_DESCRIPTION } from "./astra-tool-contracts";

const findArgsSchema = z.object({
  date_expression: z
    .string()
    .min(1)
    .describe(
      "Caller natural-language date for the search window (e.g. Tuesday, next Friday, March 3). Required.",
    ),
  time_expression: z
    .string()
    .nullable()
    .describe(
      "Optional natural-language time or daypart (e.g. afternoon, after 3pm). Null if caller gave date only.",
    ),
  service_id: z
    .string()
    .nullable()
    .describe("Optional service id override. Null to use the default configured service for this line."),
});

export type FindAvailabilityArgs = z.infer<typeof findArgsSchema>;

export function buildFindAvailabilityOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "find_availability",
    parameters: findArgsSchema,
    description: FIND_AVAILABILITY_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const findAvailabilityTool: VoiceToolDefinition<FindAvailabilityArgs> = {
  name: "find_availability",
  description: "find_availability",
  parameters: {},
  validate: (raw) => findArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    let snap = ctx.runtime.getSnapshot();
    const sched = mergeSchedulingNaturalLanguage(snap, {
      dateExpression: args.date_expression,
      timeExpression: args.time_expression,
    });
    snap = mergeDialogActiveGoalFromTool(sched.context, "BOOK_APPOINTMENT");
    ctx.runtime.replaceContext(snap);
    snap = ctx.runtime.getSnapshot();

    const rules = evaluateVoiceV3Rules(snap, config);
    if (rules.schedulingRequiresClarification) {
      return voiceToolError(
        "SCHEDULING_CLARIFICATION_REQUIRED",
        "Scheduling needs clarification before searching availability.",
        { reason: rules.schedulingClarificationReason },
        "not_ready",
      );
    }

    const silentHooks = {
      onLiveContext: (event: { type: string; [key: string]: unknown }) => {
        ctx.sendContext(event);
      },
    };

    await dispatchFindAvailabilityIfRequired(ctx.runtime, {
      ...silentHooks,
      awaitCompletion: true,
    });

    const after = ctx.runtime.getSnapshot();
    const offer = after.availability.activeOfferSet;
    if (after.availability.status === "failed") {
      return voiceToolError(
        after.availability.lastFailure?.code ?? "FIND_FAILED",
        "Availability search failed.",
        { failure: after.availability.lastFailure },
        "failed",
      );
    }
    if (!offer || offer.slots.length === 0) {
      return toolOk("none_available", {
        scheduling_generation: after.scheduling.generation,
      });
    }

    return toolOk("available", {
      offer_set_id: offer.offerSetId,
      scheduling_generation: after.scheduling.generation,
      slots: offer.slots.map((s) => ({
        slot_id: s.slotId,
        local_start: s.localStart,
        display: s.displayLabel,
      })),
    });
  },
};
