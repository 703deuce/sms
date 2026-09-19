import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { applyCallerMeaningToContext } from "../intake/apply-caller-meaning";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { emptyCallerMeaningBase } from "./meaning-defaults";

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
  if (!("date_expression" in row)) row.date_expression = null;
  if (!("time_expression" in row)) row.time_expression = null;
  if (!("active_goal" in row)) row.active_goal = null;
  return row;
}

function buildUpdateIntakeZod(config: VoiceV3AgentConfig) {
  const fieldShape: Record<string, z.ZodNullable<z.ZodString>> = {};
  for (const f of config.intakeFields) {
    fieldShape[f.key] = z.string().nullable();
  }
  return z.object({
    ...fieldShape,
    date_expression: z.string().nullable(),
    time_expression: z.string().nullable(),
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
      .nullable(),
  });
}

export function buildUpdateIntakeOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "update_intake",
    parameters: buildUpdateIntakeZod(config),
    description:
      "Update authoritative customer intake fields (name, email, phone) and active goal when the caller provides or corrects contact information. Do not call for availability-only questions — use find_availability. Does not book or search the calendar by itself.",
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
    const meaning = emptyCallerMeaningBase();
    if (typeof args.active_goal === "string" && args.active_goal.trim()) {
      meaning.active_goal = args.active_goal;
    }
    for (const field of config.intakeFields) {
      const v = args[field.key as keyof typeof args];
      if (typeof v === "string" && v.trim()) {
        meaning.captured_fields.push({
          key: field.key,
          value: v.trim(),
          confidence: 1,
        });
      }
    }
    if (typeof args.date_expression === "string" && args.date_expression.trim()) {
      meaning.scheduling.date_expression = args.date_expression.trim();
    }
    if (typeof args.time_expression === "string" && args.time_expression.trim()) {
      meaning.scheduling.time_expression = args.time_expression.trim();
      meaning.scheduling.time_kind = "DAYPART";
    }

    const snap = ctx.runtime.getSnapshot();
    const applied = applyCallerMeaningToContext(snap, config, meaning);
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
