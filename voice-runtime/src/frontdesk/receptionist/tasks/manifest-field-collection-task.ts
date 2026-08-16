import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import type { FrontDeskUserData } from "../../userdata";
import { speakReceptionistCollectionLine } from "../field-collection-task";
import { persistActiveFieldAnswer } from "../process-active-field-answer";
import {
  agentTaskSuperOptions,
  nestedTaskOptionsFromSession,
} from "../../../tasks/task-context";
import {
  formatToolFeedbackForModel,
  toolFeedbackRecoverable,
} from "@/lib/voice/tool-feedback";

export type ManifestFieldCollectionResult = {
  fieldId: string;
  value: string;
};

/** One manifest field — custom AgentTask for business-specific questions. */
export class ManifestFieldCollectionTask extends voice.AgentTask<ManifestFieldCollectionResult> {
  private readonly field: AgentFieldDefinition;
  private readonly sessionRef: AgentSession<FrontDeskUserData>;

  constructor(
    field: AgentFieldDefinition,
    sessionRef: AgentSession<FrontDeskUserData>,
    additionalFieldIds: string[],
    onAdditionalField?: (
      fieldId: string,
      value: string,
    ) => Promise<{ ok: boolean; message?: string }>,
  ) {
    let taskRef: ManifestFieldCollectionTask | undefined;

    const recordField = llm.tool({
      name: "record_field_value",
      description: `Record the caller's answer for ${field.label}.`,
      parameters: z.object({
        value: z.string().describe("Caller answer"),
      }),
      execute: async ({ value }) => {
        const trimmed = value.trim();
        if (!trimmed) {
          throw new llm.ToolError(`Please provide your ${field.label}.`);
        }
        const result = persistActiveFieldAnswer(
          sessionRef.userData,
          field.id,
          trimmed,
          field,
        );
        if (result.status === "incomplete_phone") {
          throw new llm.ToolError(result.message);
        }
        if (result.status !== "saved") {
          throw new llm.ToolError(
            result.status === "invalid" ? result.message : "Could not save field.",
          );
        }
        taskRef?.complete({ fieldId: field.id, value: result.normalized });
        return "Saved.";
      },
    });

    const additionalTool =
      additionalFieldIds.length > 0 && onAdditionalField
        ? llm.tool({
            name: "record_additional_field",
            description: "Silently record another volunteered field.",
            parameters: z.object({
              field_id: z
                .enum(additionalFieldIds as [string, ...string[]])
                .describe("Field id"),
              value: z.string().describe("Value"),
            }),
            execute: async ({ field_id, value }) => {
              const saved = await onAdditionalField(field_id, value.trim());
              if (!saved.ok) {
                return formatToolFeedbackForModel(
                  toolFeedbackRecoverable({
                    tool: "record_additional_field",
                    recovery_class: "INVALID_INFORMATION",
                    reason: "validation_failed",
                    field_id,
                    next_action: "continue_conversation",
                    guidance: saved.message || "Invalid value",
                  }),
                );
              }
              return "OK";
            },
          })
        : null;

    super(
      agentTaskSuperOptions(
        {
          instructions:
            `Collect exactly one field: ${field.label}. ` +
            "When the caller answers, call record_field_value. " +
            "Volunteered details for other fields: record_additional_field silently first. " +
            "Do not ask for other missing fields in the same question.",
          tools: additionalTool ? [recordField, additionalTool] : [recordField],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );

    taskRef = this;
    this.field = field;
    this.sessionRef = sessionRef;
  }

  async onEnter(): Promise<void> {
    const existing = this.sessionRef.userData.receptionistFields?.[this.field.id]?.trim();
    if (existing) {
      this.complete({ fieldId: this.field.id, value: existing });
      return;
    }

    const question = this.field.question?.trim() || `What is your ${this.field.label}?`;
    console.log(
      JSON.stringify({
        source: "manifest-field-collection-task",
        event: "collection_prompt_started",
        callId: this.sessionRef.userData.callId,
        activeFieldId: this.field.id,
        promptText: question.slice(0, 200),
      }),
    );
    await speakReceptionistCollectionLine(this.sessionRef, question, { addToChatCtx: true });
  }
}
