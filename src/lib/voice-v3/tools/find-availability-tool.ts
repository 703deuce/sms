import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { dispatchFindAvailabilityIfRequired } from "../calendar/find-dispatch";
import { applyCallerMeaningToContext } from "../intake/apply-caller-meaning";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { emptyCallerMeaningBase } from "./meaning-defaults";

const findArgsSchema = z.object({
  date_expression: z.string().min(1),
  time_expression: z.string().nullable(),
  service_id: z.string().nullable(),
});

export type FindAvailabilityArgs = z.infer<typeof findArgsSchema>;

export function buildFindAvailabilityOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "find_availability",
    parameters: findArgsSchema,
    description:
      "Search Microsoft calendar for available appointment times when the caller wants availability and enough scheduling information is known. Does not book. Returns when search is started or completed.",
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
    const meaning = emptyCallerMeaningBase();
    meaning.active_goal = "BOOK_APPOINTMENT";
    meaning.scheduling = {
      ...meaning.scheduling,
      date_expression: args.date_expression,
      time_expression: args.time_expression ?? null,
      time_kind: args.time_expression ? "DAYPART" : "UNSPECIFIED",
    };

    let snap = ctx.runtime.getSnapshot();
    const applied = applyCallerMeaningToContext(snap, config, meaning);
    ctx.runtime.replaceContext(applied.context);
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
