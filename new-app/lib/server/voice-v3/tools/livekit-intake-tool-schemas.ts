import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { IntakeFieldDefinition, VoiceV3AgentConfig } from "../config/agent-config";
import { intakeFieldSchemaDescription } from "../intake-objective/build-intake-tool-schema";
import {
  hasLiveKitActiveCollector,
  resolveIntakeCollectionKind,
} from "../intake-objective/resolve-intake-collection-kind";

export const COLLECT_INTAKE_FIELD_TOOL_NAME = "collect_intake_field";

/** Stable LiveKit function name for one wizard intake field (passive capture). */
export function liveKitIntakeFieldToolName(fieldKey: string): string {
  const safe = fieldKey.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "field";
  return `set_intake_${safe}`;
}

function passiveFieldToolDescription(field: IntakeFieldDefinition): string {
  const base = `Record the caller's ${field.label} when they clearly provide or correct it in conversation. Persist by field id \`${field.key}\`. Do not use for scheduling dates/times — use set_scheduling_preference. Prefer update_intake when multiple intake fields are supplied in one statement.`;
  if (!hasLiveKitActiveCollector(field)) {
    return base;
  }
  const kind = resolveIntakeCollectionKind(field);
  const taskHint =
    kind === "livekit_get_phone"
      ? "GetPhoneNumberTask"
      : kind === "livekit_get_email"
        ? "GetEmailTask"
        : kind === "livekit_get_name"
          ? "GetNameTask"
          : kind === "livekit_get_address"
            ? "GetAddressTask"
            : "GetDOBTask";
  return `${base} When you need to ask the caller for this field and it is not already persisted, use collect_intake_field (LiveKit ${taskHint}) instead of guessing digits or spelling in this tool.`;
}

function buildPassiveFieldTool(field: IntakeFieldDefinition): FunctionTool {
  const toolName = liveKitIntakeFieldToolName(field.key);
  const zodTool = zodResponsesFunction({
    name: toolName,
    parameters: z.object({
      value: z
        .string()
        .nullable()
        .describe(
          `${intakeFieldSchemaDescription(field)} Use null if the caller did not clearly provide this value in this turn.`,
        ),
    }),
    description: passiveFieldToolDescription(field),
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

function buildCollectIntakeFieldTool(config: VoiceV3AgentConfig): FunctionTool | null {
  const keys = config.intakeFields.map((f) => f.key).filter(Boolean);
  if (keys.length === 0) return null;

  const keyEnum = z.enum(keys as [string, ...string[]]);
  const zodTool = zodResponsesFunction({
    name: COLLECT_INTAKE_FIELD_TOOL_NAME,
    parameters: z.object({
      field_key: keyEnum.describe(
        "Configured intake field to actively collect and validate when still missing and required for the current business action.",
      ),
    }),
    description:
      "Actively collect and validate ONE missing configured intake field using LiveKit prebuilt tasks (name, email, phone, address, date of birth). Use when you are asking the caller for that specific field and it is not already persisted — not for facts they clearly volunteered in the same turn (use update_intake for multi-field statements). Do not use for calendar scheduling semantics or free-text custom fields without a LiveKit task.",
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

/** LiveKit-native intake tools: per-field passive capture + active collection helper. */
export function buildLiveKitIntakeFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  if (!config.capabilities?.collectIntake && config.intakeFields.length === 0) {
    return [];
  }
  const tools: FunctionTool[] = config.intakeFields.map((f) => buildPassiveFieldTool(f));
  const collect = buildCollectIntakeFieldTool(config);
  if (collect) tools.push(collect);
  return tools;
}

/** Field metadata for the Python worker (task routing + persistence keys). */
export function buildLiveKitIntakeFieldMetadata(config: VoiceV3AgentConfig) {
  return config.intakeFields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    description: f.description,
    collectionStrategy: f.collectionStrategy ?? "standard",
    collectionKind: f.collectionKind ?? resolveIntakeCollectionKind(f),
    enumValues: f.enumValues ?? null,
    verificationRequired: f.verificationRequired ?? false,
    liveKitToolName: liveKitIntakeFieldToolName(f.key),
  }));
}
