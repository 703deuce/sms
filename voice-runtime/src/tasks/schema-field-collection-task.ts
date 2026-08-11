import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { RealEstateFieldDefinition } from "@/lib/voice/real-estate/types";
import type { FrontDeskUserData } from "../frontdesk/userdata";
import { agentTaskSuperOptions, nestedTaskOptionsFromSession } from "./task-context";

export type SchemaFieldCollectionResult = {
  fieldId: string;
  value: string;
};

export type SchemaFieldCollectionHandlers = {
  onRecord: (value: string) => Promise<{ ok: boolean; speak?: string }>;
  validate?: (value: string) => string | null;
};

/**
 * LiveKit AgentTask for one schema-driven field — bounded structured collection
 * with a typed result. Used by Realtor front desk for fields that benefit from
 * focused turn-taking without a workflow graph executor.
 */
export class SchemaFieldCollectionTask extends voice.AgentTask<SchemaFieldCollectionResult> {
  constructor(
    private readonly field: RealEstateFieldDefinition,
    private readonly sessionRef: AgentSession<FrontDeskUserData>,
    private readonly handlers: SchemaFieldCollectionHandlers,
  ) {
    const question =
      field.collection_instruction?.trim() || `What is your ${field.label}?`;

    super(
      agentTaskSuperOptions(
        {
          instructions:
            `Collect exactly one field: ${field.label}. ` +
            `Ask naturally: ${question} ` +
            "When the caller answers, call record_schema_field_value.",
          tools: [
            llm.tool({
              name: "record_schema_field_value",
              description: `Record the caller's ${field.label}.`,
              parameters: z.object({
                value: z.string().describe(`The caller's ${field.label}`),
              }),
              execute: async ({ value }) => {
                const trimmed = value.trim();
                if (!trimmed) {
                  throw new llm.ToolError(`Please provide your ${field.label}.`);
                }
                const validationError = handlers.validate?.(trimmed);
                if (validationError) {
                  throw new llm.ToolError(validationError);
                }
                const saved = await handlers.onRecord(trimmed);
                if (!saved.ok) {
                  throw new llm.ToolError(saved.speak || "I couldn't save that.");
                }
                this.complete({ fieldId: field.field_id, value: trimmed });
                return saved.speak || "Saved.";
              },
            }),
          ],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );
  }

  async onEnter(): Promise<void> {
    const question =
      this.field.collection_instruction?.trim() ||
      `Could I get your ${this.field.label}?`;
    await this.session.generateReply({
      instructions: `Ask one short question to collect: ${question}`,
      toolChoice: "none",
    });
  }
}

export async function runSchemaFieldCollectionTask(input: {
  session: AgentSession<FrontDeskUserData>;
  field: RealEstateFieldDefinition;
  handlers: SchemaFieldCollectionHandlers;
}): Promise<SchemaFieldCollectionResult> {
  const task = new SchemaFieldCollectionTask(input.field, input.session, input.handlers);
  input.session.updateAgent(task);
  return task.run();
}
