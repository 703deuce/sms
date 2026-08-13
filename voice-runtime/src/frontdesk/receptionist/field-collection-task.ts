import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import type { FrontDeskUserData } from "../userdata";
import { agentTaskSuperOptions, nestedTaskOptionsFromSession } from "../../tasks/task-context";

export type ReceptionistFieldCollectionResult = {
  collected: string[];
  complete: boolean;
};

type SequenceState = {
  collectedIds: string[];
  remaining: AgentFieldDefinition[];
};

/**
 * Collect caller fields from the receptionist field manifest without RE callState.
 */
export class ReceptionistFieldCollectionTask extends voice.AgentTask<ReceptionistFieldCollectionResult> {
  private readonly sequenceState: SequenceState;

  constructor(
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    private readonly fields: AgentFieldDefinition[],
  ) {
    const sequenceState: SequenceState = {
      collectedIds: [],
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

        const ud = sessionRef.userData;
        if (!ud.receptionistFields) ud.receptionistFields = {};
        ud.receptionistFields[current.id] = trimmed;
        if (!sequenceState.collectedIds.includes(current.id)) {
          sequenceState.collectedIds.push(current.id);
        }

        const next = currentField();
        if (!next) {
          this.complete({ collected: [...sequenceState.collectedIds], complete: true });
          return "All caller information recorded.";
        }
        return `Saved ${current.label}. Next ask: ${next.question}`;
      },
    });

    super(
      agentTaskSuperOptions(
        {
          instructions:
            "Collect the caller's information one field at a time. Ask naturally, record each answer with record_caller_field, then move on.",
          tools: [recordTool],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );

    this.sequenceState = sequenceState;
  }

  async onEnter(): Promise<void> {
    const first = this.fields.find(
      (f) => !this.sessionRef.userData.receptionistFields?.[f.id]?.trim(),
    );
    if (!first) {
      this.complete({
        collected: this.fields.map((f) => f.id),
        complete: true,
      });
      return;
    }
    await this.sessionRef.generateReply({
      instructions: `Ask the caller: ${first.question}`,
      toolChoice: "none",
    });
  }
}
