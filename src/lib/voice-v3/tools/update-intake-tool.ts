import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { applyIntakeToolPatch } from "../intake/merge-intake-state";
import {
  ACTIVE_GOAL_ENUM_DESCRIPTION,
  UPDATE_INTAKE_TOOL_DESCRIPTION,
} from "./astra-tool-contracts";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";

export type UpdateIntakeArgs = Record<string, unknown>;

function normalizeUpdateIntakeArguments(
  config: VoiceV3AgentConfig,
  raw: unknown,
): Record<string, unknown> {
  const row =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  for (const f of config.intakeFields) {
    if (!(f.key in row)) row[f.key] = null;
  }
  if (!("active_goal" in row)) row.active_goal = null;
  return row;
}

function buildUpdateIntakeZod(config: VoiceV3AgentConfig) {
  const fieldShape: Record<string, z.ZodNullable<z.ZodString>> = {};
  const semanticHints: Record<string, string> = {
    name: "Caller's full name as clearly provided or corrected by the caller.",
    email: "Caller's email address as clearly provided or corrected by the caller.",
    phone: "Caller's phone number when explicitly provided or when this field stores the verified caller number.",
    service_reason: "Brief description of the service, issue, or reason for the caller's request.",
  };
  for (const f of config.intakeFields) {
    const hint =
      semanticHints[f.key] ?? f.description?.trim() ?? `${f.label} (${f.type})`;
    fieldShape[f.key] = z
      .string()
      .nullable()
      .describe(
        f.required
          ? `Required intake: ${hint} Null if caller did not provide or correct this field in this turn.`
          : `Optional intake: ${hint} Null if not provided this turn.`,
      );
  }
  return z.object({
    ...fieldShape,
    active_goal: z
      .enum([
        "UNKNOWN",
        "GENERAL",
        "BOOK_APPOINTMENT",
        "RESCHEDULE_APPOINTMENT",
        "CANCEL_APPOINTMENT",
        "REQUEST_CALLBACK",
        "REQUEST_TRANSFER",
      ])
      .nullable()
      .describe(ACTIVE_GOAL_ENUM_DESCRIPTION),
  });
}

export function buildUpdateIntakeOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "update_intake",
    parameters: buildUpdateIntakeZod(config),
    description: UPDATE_INTAKE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const updateIntakeTool: VoiceToolDefinition<UpdateIntakeArgs> = {
  name: "update_intake",
  description: "update_intake",
  parameters: {},
  validate: (raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("expected object");
    }
    return raw as UpdateIntakeArgs;
  },
  execute: async (ctx, raw) => {
    const config = ctx.runtime.config;
    const schema = buildUpdateIntakeZod(config);
    const parsed = schema.safeParse(normalizeUpdateIntakeArguments(config, raw));
    if (!parsed.success) {
      return voiceToolError(
        "INVALID_ARGUMENTS",
        "Intake update arguments are invalid.",
        { issues: parsed.error.issues.map((i) => i.message) },
      );
    }
    const args = parsed.data;
    const fieldValues: Array<{ key: string; value: string }> = [];
    for (const field of config.intakeFields) {
      const v = args[field.key as keyof typeof args];
      if (typeof v === "string" && v.trim()) {
        fieldValues.push({ key: field.key, value: v.trim() });
      }
    }

    const snap = ctx.runtime.getSnapshot();
    const applied = applyIntakeToolPatch(snap, config, {
      active_goal: args.active_goal,
      fieldValues,
    });
    ctx.runtime.replaceContext(applied.context);

    const rules = evaluateVoiceV3Rules(ctx.runtime.getSnapshot(), config);
    const updated: string[] = [...applied.fieldsChanged];
    const stillRequired = rules.missingRequiredFields;

    return toolOk("updated", {
      updated_fields: updated,
      still_required: stillRequired,
      state_version: ctx.runtime.getSnapshot().runtime.version,
    });
  },
};
