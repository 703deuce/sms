import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { deriveIntakeObjective } from "../intake-objective";
import { mergeDialogActiveGoalFromOperation } from "../intake/merge-intake-state";
import { resolveStoredIntakeString } from "../intake-objective/resolve-stored-intake";
import {
  resolveActiveIntakeOperation,
  type VoiceOperationName,
} from "../intake-objective/operation-requirements";
import type { VoiceToolDefinition } from "./types";
import { toolOk } from "./types";

const OPERATIONS = [
  "book_appointment",
  "request_callback",
  "take_message",
  "send_booking_link",
  "unresolved",
] as const;

export type GetIntakeStateArgs = {
  operation?: VoiceOperationName | null;
};

export function buildGetIntakeStateOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "get_intake_state",
    parameters: z.object({
      operation: z.enum(OPERATIONS).nullable().optional().describe(
        "Active operation for required-field resolution; omit to use runtime active operation.",
      ),
    }),
    description: "Internal: read authoritative intake values and missing required fields for the LiveKit intake task.",
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const getIntakeStateTool: VoiceToolDefinition<GetIntakeStateArgs> = {
  name: "get_intake_state",
  description: "get_intake_state",
  parameters: {},
  validate: (raw) => {
    if (!raw || typeof raw !== "object") return {};
    return raw as GetIntakeStateArgs;
  },
  execute: async (ctx, raw) => {
    const config = ctx.runtime.config;
    let snap = ctx.runtime.getSnapshot();
    const op =
      raw.operation && raw.operation !== "unresolved"
        ? raw.operation
        : resolveActiveIntakeOperation(config, snap);

    if (op !== "unresolved") {
      const withGoal = mergeDialogActiveGoalFromOperation(snap, op);
      if (withGoal.runtime.version !== snap.runtime.version) {
        snap = withGoal;
        ctx.runtime.replaceContext(snap);
      }
    }

    const objective = deriveIntakeObjective(config, snap, op);
    const values: Record<string, string> = {};
    for (const field of config.intakeFields) {
      const v = resolveStoredIntakeString(snap.intake.values, field.key);
      if (v) values[field.key] = v;
    }

    return toolOk("INTAKE_STATE", {
      operation: op,
      values,
      missing_required_fields: objective.missingRequiredFields,
      objective: {
        status: objective.status,
        missing_required_fields: objective.missingRequiredFields,
      },
      intake_fields: config.intakeFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        description: f.description,
        enumValues: f.enumValues ?? null,
        collectionKind: f.collectionKind ?? null,
      })),
      state_version: snap.runtime.version,
    });
  },
};
