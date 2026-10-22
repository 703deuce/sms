import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import {
  buildIntakeObjectiveContext,
  buildUpdateIntakeZodSchema,
  deriveIntakeObjective,
  mergeIntakeUpdate,
  normalizeUpdateIntakeArguments,
} from "../intake-objective";
import { hasLiveKitActiveCollector } from "../intake-objective/resolve-intake-collection-kind";
import { logIntakeTelemetry } from "../intake-objective/telemetry";
import { buildSharedCallerFactsLiveSummary } from "../intake-objective/build-shared-caller-facts";
import { LiveContextPublisher } from "../live/live-context-publisher";
import { UPDATE_INTAKE_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";

export type UpdateIntakeArgs = Record<string, unknown>;

export function buildUpdateIntakeOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "update_intake",
    parameters: buildUpdateIntakeZodSchema(config),
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
    const schema = buildUpdateIntakeZodSchema(config);
    const normalized = normalizeUpdateIntakeArguments(config, raw);
    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
      return voiceToolError(
        "INVALID_ARGUMENTS",
        "Intake update arguments are invalid.",
        { issues: parsed.error.issues.map((i) => i.message) },
      );
    }

    const started = Date.now();
    const snap = ctx.runtime.getSnapshot();
    const priorObjective = deriveIntakeObjective(config, snap);

    logIntakeTelemetry("INTAKE_UPDATE_REQUESTED", {
      call_id: ctx.callId,
      delegation_id: ctx.delegationId,
      function_call_id: ctx.functionCallId,
      objective_status: priorObjective.status,
    });

    const updatePayload: Record<string, string | null> = {};
    for (const field of config.intakeFields) {
      const v = parsed.data[field.key as keyof typeof parsed.data];
      updatePayload[field.key] = typeof v === "string" ? v : null;
    }

    const merged = mergeIntakeUpdate({
      current: snap.intake.values,
      update: updatePayload,
      config,
      at: new Date(),
      sourceCallId: ctx.callId,
      sourceDelegationId: ctx.delegationId,
    });

    if (merged.updatedFields.length === 0 && merged.rejectedFields.length === 0) {
      const objective = deriveIntakeObjective(config, snap);
      return toolOk("INTAKE_UPDATED", {
        updated_fields: [],
        rejected_fields: [],
        missing_required_fields: objective.missingRequiredFields,
        objective: {
          status: objective.status,
          missing_required_fields: objective.missingRequiredFields,
        },
        state_version: snap.runtime.version,
      });
    }

    logIntakeTelemetry("INTAKE_UPDATE_VALIDATED", {
      call_id: ctx.callId,
      delegation_id: ctx.delegationId,
      function_call_id: ctx.functionCallId,
      duration_ms: Date.now() - started,
    });

    const nextContext = {
      ...snap,
      updatedAt: new Date().toISOString(),
      intake: { values: merged.values },
      runtime: { version: snap.runtime.version + 1 },
    };
    ctx.runtime.replaceContext(nextContext);

    const after = ctx.runtime.getSnapshot();
    const objective = deriveIntakeObjective(config, after);

    if (merged.fieldsChanged.length > 0) {
      logIntakeTelemetry("INTAKE_FIELDS_UPDATED", {
        call_id: ctx.callId,
        delegation_id: ctx.delegationId,
        function_call_id: ctx.functionCallId,
        updated_field_names: merged.fieldsChanged,
        objective_status: objective.status,
        duration_ms: Date.now() - started,
      });
    }
    if (merged.rejectedFields.length > 0) {
      logIntakeTelemetry("INTAKE_FIELDS_REJECTED", {
        call_id: ctx.callId,
        delegation_id: ctx.delegationId,
        function_call_id: ctx.functionCallId,
        rejected_field_names: merged.rejectedFields.map((r) => r.field),
      });
    }
    if (objective.status !== priorObjective.status) {
      logIntakeTelemetry(
        objective.status === "COMPLETE"
          ? "INTAKE_OBJECTIVE_COMPLETED"
          : "INTAKE_OBJECTIVE_CHANGED",
        {
          call_id: ctx.callId,
          delegation_id: ctx.delegationId,
          missing_required_field_names: objective.missingRequiredFields,
          objective_status: objective.status,
        },
      );
    }

    const publisher = new LiveContextPublisher(ctx.sendContext);
    publisher.appendThinking(buildIntakeObjectiveContext(config, after), ctx.delegationId);
    publisher.appendCommentary(
      buildSharedCallerFactsLiveSummary(config, after),
      ctx.delegationId,
    );

    if (merged.updatedFields.length === 0 && merged.rejectedFields.length > 0) {
      return voiceToolError(
        "INVALID_INTAKE_FIELD",
        "One or more intake fields could not be saved.",
        {
          rejected_fields: merged.rejectedFields,
          missing_required_fields: objective.missingRequiredFields,
        },
        "error",
        false,
      );
    }

    return toolOk("INTAKE_UPDATED", {
      updated_fields: merged.updatedFields,
      rejected_fields: merged.rejectedFields.map((r) => {
        const field = config.intakeFields.find((f) => f.key === r.field);
        const suggestCollect =
          field &&
          (r.code === "INVALID_FORMAT" || r.code === "EMPTY_VALUE") &&
          hasLiveKitActiveCollector(field)
            ? { use_collect_intake_field: true, field_key: r.field }
            : undefined;
        return {
          field: r.field,
          code: r.code,
          ...(suggestCollect ? { recovery: suggestCollect } : {}),
        };
      }),
      missing_required_fields: objective.missingRequiredFields,
      objective: {
        status: objective.status,
        missing_required_fields: objective.missingRequiredFields,
      },
      state_version: after.runtime.version,
    });
  },
};
