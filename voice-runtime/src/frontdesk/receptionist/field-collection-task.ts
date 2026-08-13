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

    const currentField = (): AgentFieldDefinition | undefined => {
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
          throw new llm.ToolError(`Please provide your ${current.label}.`);
        }

        let normalized: string;
        try {
          normalized = validateReceptionistFieldValue(current, trimmed);
        } catch (err) {
          const message = err instanceof Error ? err.message : `Please provide your ${current.label}.`;
          throw new llm.ToolError(message);
        }

        const ud = sessionRef.userData;
        if (!ud.receptionistFields) ud.receptionistFields = {};
        ud.receptionistFields[current.id] = normalized;
        if (!sequenceState.collectedIds.includes(current.id)) {
          sequenceState.collectedIds.push(current.id);
        }
        sequenceState.remaining = sequenceState.remaining.filter((f) => f.id !== current.id);

        const next = currentField();
        if (!next) {
          finishCollection(true);
          return "Recorded — collection complete. Do not speak.";
        }

        const line = buildReceptionistFieldTransitionLine(current, normalized, next);
        await speakReceptionistCollectionLine(sessionRef, line);
        return "Recorded — next question already asked. Do not speak.";
      },
    });

    super(
      agentTaskSuperOptions(
        {
          instructions:
            "Collect caller information one field at a time. " +
            FIELD_TRANSITION_BRIDGE_RULES +
            " When the caller answers, call record_caller_field immediately without speaking. " +
            "The runtime asks the next question. Never narrate routing to the caller.",
          tools: [recordTool],
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
