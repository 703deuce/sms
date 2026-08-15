import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { buildReceptionistFieldTransitionLine } from "@/lib/voice/receptionist/field-transition-phrases";
import { validateReceptionistFieldValue } from "@/lib/voice/receptionist/field-validation";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import { FIELD_TRANSITION_BRIDGE_RULES } from "@/lib/voice/field-transition-bridge";
import type { FrontDeskUserData } from "../userdata";
import { deliverScriptedSpeech } from "../../outbound/scripted-speech";
import {
  agentTaskSuperOptions,
  receptionistOperationalTaskOptionsFromSession,
} from "../../tasks/task-context";
import {
  markTaskCompleted,
  markTaskOnEnterStarted,
  markTaskStarted,
} from "../../task-transition-instrumentation";
import {
  formatToolFeedbackForModel,
  toolFeedbackMissingCallerField,
  toolFeedbackRecoverable,
} from "@/lib/voice/tool-feedback";

export type ReceptionistFieldCollectionResult = {
  collected: string[];
  complete: boolean;
  fields: Record<string, string>;
};

const TASK_ID = "receptionist_field_collection";
const TASK_TYPE = "ReceptionistFieldCollectionTask";

/** Scripted lines stay out of chat_ctx so handoff does not replay child speech into Realtime. */
export async function speakReceptionistCollectionLine(
  session: AgentSession<FrontDeskUserData>,
  line: string,
): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;
  await deliverScriptedSpeech(session, trimmed, {
    allowInterruptions: true,
    addToChatCtx: false,
  });
}

/**
 * Short operational AgentTask — collects missing caller fields, persists to userData,
 * returns typed result. Conversationally invisible at the parent boundary.
 */
export class ReceptionistFieldCollectionTask extends voice.AgentTask<ReceptionistFieldCollectionResult> {
  private readonly sequenceState: {
    collectedIds: string[];
    remaining: AgentFieldDefinition[];
  };

  constructor(
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    private readonly fields: AgentFieldDefinition[],
  ) {
    const sequenceState = {
      collectedIds: [] as string[],
      remaining: [...fields],
    };

    const syncBackfillFromParent = (): void => {
      const ud = sessionRef.userData;
      if (!ud.receptionistFields) ud.receptionistFields = {};
      ud.receptionistFields = applyReceptionistFieldBackfill({
        chatCtx: sessionRef.chatCtx,
        manifest: fields,
        receptionistFields: ud.receptionistFields,
        authoritativeFieldIds: ud.authoritativeFieldIds,
      });
    };

    const currentField = (): AgentFieldDefinition | undefined => {
      syncBackfillFromParent();
      for (const field of sequenceState.remaining) {
        const existing = sessionRef.userData.receptionistFields?.[field.id]?.trim();
        if (!existing) return field;
        if (!sequenceState.collectedIds.includes(field.id)) {
          sequenceState.collectedIds.push(field.id);
        }
      }
      sequenceState.remaining = [];
      return undefined;
    };

    const finishCollection = (complete: boolean): ReceptionistFieldCollectionResult => {
      const ud = sessionRef.userData;
      const result: ReceptionistFieldCollectionResult = {
        collected: [...sequenceState.collectedIds],
        complete,
        fields: { ...(ud.receptionistFields || {}) },
      };
      markTaskCompleted({
        callId: ud.callId,
        taskId: TASK_ID,
        taskType: TASK_TYPE,
        complete,
        collectedCount: result.collected.length,
      });
      ud.activeTaskInstrumentation = undefined;
      this.complete(result);
      return result;
    };

    const otherMissingFields = (): AgentFieldDefinition[] => {
      const current = currentField();
      return sequenceState.remaining.filter((f) => f.id !== current?.id);
    };

    const persistFieldValue = (
      field: AgentFieldDefinition,
      trimmed: string,
    ): { ok: true; normalized: string } | { ok: false; message: string } => {
      try {
        const normalized = validateReceptionistFieldValue(field, trimmed);
        const ud = sessionRef.userData;
        if (!ud.receptionistFields) ud.receptionistFields = {};
        ud.receptionistFields[field.id] = normalized;
        syncBackfillFromParent();
        if (!sequenceState.collectedIds.includes(field.id)) {
          sequenceState.collectedIds.push(field.id);
        }
        sequenceState.remaining = sequenceState.remaining.filter((f) => f.id !== field.id);
        return { ok: true, normalized };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Please provide your ${field.label}.`;
        return { ok: false, message };
      }
    };

    const recordTool = llm.tool({
      name: "record_caller_field",
      description: "Record the caller's answer for the current information field.",
      parameters: z.object({
        value: z.string().describe("The caller's answer"),
      }),
      execute: async ({ value }) => {
        const trimmed = value.trim();
        const current = currentField();
        if (!current) return "All fields are already collected.";
        if (!trimmed) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "record_caller_field",
              fieldId: current.id,
              fieldLabel: current.label,
            }),
          );
        }

        const saved = persistFieldValue(current, trimmed);
        if (!saved.ok) {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "record_caller_field",
              recovery_class: "INVALID_INFORMATION",
              reason: "validation_failed",
              field_id: current.id,
              field_label: current.label,
              next_action: "collect_field_then_retry",
              guidance: saved.message,
            }),
          );
        }

        const next = currentField();
        if (!next) {
          finishCollection(true);
          return "Recorded — collection complete. Do not speak.";
        }

        const line = buildReceptionistFieldTransitionLine(current, saved.normalized, next);
        await speakReceptionistCollectionLine(sessionRef, line);
        return "Recorded — next question already asked. Do not speak.";
      },
    });

    const additionalFields = otherMissingFields();
    const additionalTool =
      additionalFields.length > 0
        ? llm.tool({
            name: "record_additional_caller_field",
            description:
              "Silently record extra caller details volunteered in the same answer (unordered collection).",
            parameters: z.object({
              field_id: z
                .enum(additionalFields.map((f) => f.id) as [string, ...string[]])
                .describe(
                  `Field id. Options: ${additionalFields.map((f) => `${f.id}: ${f.label}`).join(", ")}`,
                ),
              value: z.string().describe("The caller's answer for that field"),
            }),
            execute: async ({ field_id, value }) => {
              const trimmed = value.trim();
              const field = additionalFields.find((f) => f.id === field_id);
              if (!trimmed) {
                return formatToolFeedbackForModel(
                  toolFeedbackMissingCallerField({
                    tool: "record_additional_caller_field",
                    fieldId: field_id,
                    fieldLabel: field?.label || field_id,
                  }),
                );
              }
              if (!field) return "That field is not part of this collection.";
              const saved = persistFieldValue(field, trimmed);
              if (!saved.ok) {
                return formatToolFeedbackForModel(
                  toolFeedbackRecoverable({
                    tool: "record_additional_caller_field",
                    recovery_class: "INVALID_INFORMATION",
                    reason: "validation_failed",
                    field_id,
                    field_label: field.label,
                    next_action: "collect_field_then_retry",
                    guidance: saved.message,
                  }),
                );
              }
              return "OK";
            },
          })
        : null;

    const multiFieldHint =
      additionalTool
        ? "If the caller volunteers multiple details in one answer, silently call record_additional_caller_field for each extra detail, then record_caller_field for the current field. "
        : "";

    super(
      agentTaskSuperOptions(
        {
          instructions:
            "Collect caller information — required fields may be satisfied in any order. " +
            multiFieldHint +
            "Caller details already captured in this call must not be asked again — " +
            "the runtime syncs prior answers from the conversation. " +
            FIELD_TRANSITION_BRIDGE_RULES +
            " When the caller answers, call record_caller_field immediately without speaking. " +
            "The runtime asks the next question. Never narrate routing to the caller.",
          tools: additionalTool ? [recordTool, additionalTool] : [recordTool],
        },
        receptionistOperationalTaskOptionsFromSession(sessionRef),
      ),
    );

    this.sequenceState = sequenceState;
  }

  async onEnter(): Promise<void> {
    const ud = this.sessionRef.userData;
    if (!ud.receptionistFields) ud.receptionistFields = {};
    ud.receptionistFields = applyReceptionistFieldBackfill({
      chatCtx: this.sessionRef.chatCtx,
      manifest: this.fields,
      receptionistFields: ud.receptionistFields,
      authoritativeFieldIds: ud.authoritativeFieldIds,
    });

    markTaskStarted({
      callId: ud.callId,
      taskId: TASK_ID,
      taskType: TASK_TYPE,
    });
    markTaskOnEnterStarted({
      callId: ud.callId,
      taskId: TASK_ID,
      taskType: TASK_TYPE,
    });
    ud.activeTaskInstrumentation = {
      taskId: TASK_ID,
      taskType: TASK_TYPE,
    };

    const first = this.fields.find(
      (f) => !this.sessionRef.userData.receptionistFields?.[f.id]?.trim(),
    );
    if (!first) {
      markTaskCompleted({
        callId: ud.callId,
        taskId: TASK_ID,
        taskType: TASK_TYPE,
        complete: true,
        collectedCount: this.fields.length,
      });
      ud.activeTaskInstrumentation = undefined;
      this.complete({
        collected: this.fields.map((f) => f.id),
        complete: true,
        fields: { ...(ud.receptionistFields || {}) },
      });
      return;
    }

    if (ud.receptionistFieldCollectionPrefaceSpoken) {
      ud.receptionistFieldCollectionPrefaceSpoken = false;
      return;
    }

    await speakReceptionistCollectionLine(this.sessionRef, first.question);
  }
}
