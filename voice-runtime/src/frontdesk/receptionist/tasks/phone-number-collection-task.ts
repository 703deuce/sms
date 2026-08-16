import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { captureUsPhoneDigits } from "@/lib/voice/receptionist/field-validation";
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

export type PhoneNumberCollectionResult = {
  fieldId: string;
  phoneNumber: string;
};

/**
 * LiveKit-style phone collection task (TS port of Python GetPhoneNumberTask).
 * Owns the conversation until a complete normalized number exists — not one STT fragment.
 */
export class PhoneNumberCollectionTask extends voice.AgentTask<PhoneNumberCollectionResult> {
  private readonly field: AgentFieldDefinition;
  private readonly sessionRef: AgentSession<FrontDeskUserData>;
  private digitBuffer = "";

  constructor(
    field: AgentFieldDefinition,
    sessionRef: AgentSession<FrontDeskUserData>,
    additionalFieldIds: string[],
    onAdditionalField?: (
      fieldId: string,
      value: string,
    ) => Promise<{ ok: boolean; message?: string }>,
  ) {
    let digitBuffer = "";
    let taskRef: PhoneNumberCollectionTask | undefined;

    const updatePhone = llm.tool({
      name: "update_phone_number",
      description:
        "Update the phone number from caller speech. Call whenever you hear new digits — partial groups are OK.",
      parameters: z.object({
        phone_fragment: z.string().describe("Digits or spoken phone fragment from the caller"),
      }),
      execute: async ({ phone_fragment }) => {
        const capture = captureUsPhoneDigits(phone_fragment, digitBuffer);
        if (capture.status === "incomplete") {
          digitBuffer = capture.digits;
          if (taskRef) taskRef.digitBuffer = digitBuffer;
          console.log(
            JSON.stringify({
              source: "phone-number-collection-task",
              event: "phone_partial_buffered",
              callId: sessionRef.userData.callId,
              buffer: digitBuffer,
            }),
          );
          return `Partial number buffered (${digitBuffer.length}/10 digits). Ask for the rest if needed.`;
        }

        const result = persistActiveFieldAnswer(
          sessionRef.userData,
          field.id,
          capture.normalized,
          field,
          digitBuffer,
        );
        if (result.status !== "saved") {
          throw new llm.ToolError(
            result.status === "invalid" ? result.message : "Could not save phone number.",
          );
        }

        taskRef?.complete({
          fieldId: field.id,
          phoneNumber: result.normalized,
        });
        return "Phone number complete.";
      },
    });

    const additionalTool =
      additionalFieldIds.length > 0 && onAdditionalField
        ? llm.tool({
            name: "record_additional_field",
            description:
              "Silently record another field the caller volunteered. Do not ask for fields already collected.",
            parameters: z.object({
              field_id: z
                .enum(additionalFieldIds as [string, ...string[]])
                .describe("Field id from manifest"),
              value: z.string().describe("Caller value"),
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
            `Collect phone number for field "${field.label}". ` +
            "Call update_phone_number whenever you hear digits — including partial groups. " +
            "Do not advance until update_phone_number succeeds with a complete number. " +
            "Do not ask for other intake fields in the same question.",
          tools: additionalTool ? [updatePhone, additionalTool] : [updatePhone],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );

    taskRef = this;
    this.field = field;
    this.sessionRef = sessionRef;
    this.digitBuffer = digitBuffer;
  }

  async onEnter(): Promise<void> {
    const existing = this.sessionRef.userData.receptionistFields?.[this.field.id]?.trim();
    if (existing) {
      this.complete({ fieldId: this.field.id, phoneNumber: existing });
      return;
    }

    const question = this.field.question?.trim() || "What's the best phone number to reach you?";
    console.log(
      JSON.stringify({
        source: "phone-number-collection-task",
        event: "collection_prompt_started",
        callId: this.sessionRef.userData.callId,
        activeFieldId: this.field.id,
        promptText: question.slice(0, 200),
      }),
    );
    await speakReceptionistCollectionLine(this.sessionRef, question, { addToChatCtx: true });
  }
}
