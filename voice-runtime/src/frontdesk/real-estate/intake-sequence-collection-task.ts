import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { RealEstateFieldDefinition } from "@/lib/voice/real-estate/types";
import { applyHeuristicIntakeBackfill } from "@/lib/voice/real-estate/intake-memory";
import { INTAKE_TO_BOOKING_TRANSITION_PHRASE } from "@/lib/voice/real-estate/intake-transition-phrases";
import { FIELD_TRANSITION_BRIDGE_RULES } from "@/lib/voice/field-transition-bridge";
import {
  buildIntakeFieldTransitionLine,
  intakeFieldQuestion,
  speakIntakeTransitionLine,
} from "../../intake-transition-speech";
import {
  markFirstReplyRequested,
  markTaskExitFinished,
  markTaskExitStarted,
  markTaskOnEnterStarted,
} from "../../task-transition-instrumentation";
import { agentTaskSuperOptions, nestedTaskOptionsFromSession } from "../../tasks/task-context";
import type { FrontDeskUserData } from "../userdata";

export type IntakeSequenceCollectionResult = {
  collected: string[];
  complete: boolean;
};

export type IntakeSequenceHandlers = {
  fieldsToCollect: RealEstateFieldDefinition[];
  allFields: RealEstateFieldDefinition[];
  onRecordField: (field: RealEstateFieldDefinition, value: string) => Promise<{ ok: boolean }>;
  onRecordAdditionalField?: (
    fieldId: string,
    value: string,
  ) => Promise<{ ok: boolean }>;
  isIntakeComplete: () => boolean;
};

type IntakeSequenceState = {
  collectedIds: string[];
  remaining: RealEstateFieldDefinition[];
};

/**
 * One AgentTask for the full intake sequence — avoids per-field activity handoffs
 * that cause multi-second silence on OpenAI Realtime.
 */
export class IntakeSequenceCollectionTask extends voice.AgentTask<IntakeSequenceCollectionResult> {
  private readonly sequenceState: IntakeSequenceState;

  constructor(
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    private readonly handlers: IntakeSequenceHandlers,
  ) {
    const sequenceState: IntakeSequenceState = {
      collectedIds: [],
      remaining: [...handlers.fieldsToCollect],
    };

    const pendingOptional = () =>
      handlers.allFields.filter(
        (f) =>
          !handlers.fieldsToCollect.some((c) => c.field_id === f.field_id) &&
          !sessionRef.userData.callState?.collectedFields[f.field_id]?.trim(),
      );

    const currentField = (): RealEstateFieldDefinition | undefined => {
      for (const field of sequenceState.remaining) {
        const existing = sessionRef.userData.callState?.collectedFields[field.field_id]?.trim();
        if (!existing) return field;
        if (!sequenceState.collectedIds.includes(field.field_id)) {
          sequenceState.collectedIds.push(field.field_id);
        }
      }
      sequenceState.remaining = [];
      return undefined;
    };

    const recordPrimaryTool = llm.tool({
      name: "record_schema_field_value",
      description: "Record the caller's answer for the current intake field.",
      parameters: z.object({
        value: z.string().describe("The caller's answer for the current field"),
      }),
      execute: async ({ value }) => {
        const trimmed = value.trim();
        const current = currentField();
        if (!current) {
          return "All intake fields are already collected.";
        }
        if (!trimmed) {
          throw new llm.ToolError(`Please provide your ${current.label}.`);
        }

        const saved = await handlers.onRecordField(current, trimmed);
        if (!saved.ok) {
          throw new llm.ToolError("I couldn't save that.");
        }
        if (!sequenceState.collectedIds.includes(current.field_id)) {
          sequenceState.collectedIds.push(current.field_id);
        }
        sequenceState.remaining = sequenceState.remaining.filter(
          (f) => f.field_id !== current.field_id,
        );

        const next = currentField();
        if (next) {
          const line = buildIntakeFieldTransitionLine(current, trimmed, next);
          await speakIntakeTransitionLine(sessionRef, line);
          return "OK — the next question was already asked. Do not repeat it or add filler.";
        }

        await this.finishIntakeSequence();
        return "Intake complete — do not speak; transition line was already delivered.";
      },
    });

    const optional = pendingOptional();
    const additionalTools =
      optional.length > 0 && handlers.onRecordAdditionalField
        ? [
            llm.tool({
              name: "record_additional_intake_field",
              description:
                "Silently record extra intake details the caller volunteered in the same answer.",
              parameters: z.object({
                field_id: z
                  .enum(optional.map((f) => f.field_id) as [string, ...string[]])
                  .describe(
                    `Optional intake field id. Options: ${optional.map((f) => `${f.field_id}: ${f.label}`).join(", ")}`,
                  ),
                value: z.string().describe("The caller's answer for that field"),
              }),
              execute: async ({ field_id, value }) => {
                const trimmed = value.trim();
                if (!trimmed) {
                  throw new llm.ToolError("Please provide a value for that field.");
                }
                const saved = await handlers.onRecordAdditionalField!(field_id, trimmed);
                if (!saved.ok) {
                  throw new llm.ToolError("I couldn't save that.");
                }
                return "OK";
              },
            }),
          ]
        : [];

    const multiFieldHint =
      optional.length > 0
        ? "If the caller volunteers multiple intake details in one answer, silently call record_additional_intake_field for each extra detail, then record_schema_field_value for the current field. "
        : "";

    super(
      agentTaskSuperOptions(
        {
          instructions:
            "Collect intake fields one at a time in order. " +
            multiFieldHint +
            FIELD_TRANSITION_BRIDGE_RULES +
            " When the caller answers the current field, call record_schema_field_value immediately without speaking. " +
            "The runtime will ask the next question. Never narrate backend routing to the caller.",
          tools: [recordPrimaryTool, ...additionalTools],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );

    this.sequenceState = sequenceState;
  }

  private syncRemainingFromState(): void {
    const ud = this.sessionRef.userData;
    this.sequenceState.remaining = this.handlers.fieldsToCollect.filter(
      (f) => !ud.callState?.collectedFields[f.field_id]?.trim(),
    );
  }

  private async finishIntakeSequence(): Promise<void> {
    const ud = this.sessionRef.userData;
    markTaskExitStarted({
      callId: ud.callId,
      taskId: "intake_sequence",
      taskType: "IntakeSequenceCollectionTask",
    });
    await speakIntakeTransitionLine(this.sessionRef, INTAKE_TO_BOOKING_TRANSITION_PHRASE);
    const complete = this.handlers.isIntakeComplete();
    this.complete({
      collected: [...this.sequenceState.collectedIds],
      complete,
    });
    markTaskExitFinished({
      callId: ud.callId,
      taskId: "intake_sequence",
      taskType: "IntakeSequenceCollectionTask",
    });
  }

  async onEnter(): Promise<void> {
    const ud = this.sessionRef.userData;
    markTaskOnEnterStarted({
      callId: ud.callId,
      taskId: "intake_sequence",
      taskType: "IntakeSequenceCollectionTask",
    });
    ud.activeTaskInstrumentation = {
      taskId: "intake_sequence",
      taskType: "IntakeSequenceCollectionTask",
    };

    if (ud.callState) {
      ud.callState = applyHeuristicIntakeBackfill({
        state: ud.callState,
        chatCtx: this.sessionRef.chatCtx,
        candidateFields: this.handlers.allFields,
      });
    }

    this.syncRemainingFromState();

    if (!this.sequenceState.remaining.length) {
      await this.finishIntakeSequence();
      return;
    }

    const first = this.sequenceState.remaining[0]!;
    markFirstReplyRequested({
      callId: ud.callId,
      taskId: first.field_id,
      taskType: "IntakeSequenceCollectionTask",
    });
    await speakIntakeTransitionLine(this.sessionRef, intakeFieldQuestion(first));
  }
}

export async function runIntakeSequenceCollectionTask(input: {
  session: AgentSession<FrontDeskUserData>;
  handlers: IntakeSequenceHandlers;
}): Promise<IntakeSequenceCollectionResult> {
  const task = new IntakeSequenceCollectionTask(input.session, input.handlers);
  return await task.run();
}
