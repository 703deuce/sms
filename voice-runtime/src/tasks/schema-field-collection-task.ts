import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { RealEstateFieldDefinition } from "@/lib/voice/real-estate/types";
import { applyHeuristicIntakeBackfill } from "@/lib/voice/real-estate/intake-memory";
import type { FrontDeskUserData } from "../frontdesk/userdata";
import { agentTaskSuperOptions, nestedTaskOptionsFromSession } from "./task-context";

export type SchemaFieldCollectionResult = {
  fieldId: string;
  value: string;
};

export type SchemaFieldCollectionHandlers = {
  onRecord: (value: string) => Promise<{ ok: boolean; speak?: string }>;
  validate?: (value: string) => string | null;
  /** Other intake fields still missing in this TaskGroup pass. */
  pendingFields?: RealEstateFieldDefinition[];
  onRecordAdditionalField?: (
    fieldId: string,
    value: string,
  ) => Promise<{ ok: boolean; speak?: string }>;
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
    const pending = handlers.pendingFields?.filter((f) => f.field_id !== field.field_id) ?? [];

    const recordPrimaryTool = llm.tool({
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
    });

    const additionalTools =
      pending.length > 0 && handlers.onRecordAdditionalField
        ? [
            llm.tool({
              name: "record_additional_intake_field",
              description:
                "When the caller gives multiple intake details in one answer, record each extra field here before finishing the current question.",
              parameters: z.object({
                field_id: z
                  .enum(pending.map((f) => f.field_id) as [string, ...string[]])
                  .describe(
                    `Pending intake field id. Options: ${pending.map((f) => `${f.field_id}: ${f.label}`).join(", ")}`,
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
                  throw new llm.ToolError(saved.speak || "I couldn't save that.");
                }
                return saved.speak || `Saved ${field_id}.`;
              },
            }),
          ]
        : [];

    const multiFieldHint =
      pending.length > 0
        ? "If the caller already mentioned this or other pending intake fields in the same answer, call record_additional_intake_field for each extra detail you can extract, then record_schema_field_value for this field. Do not re-ask for details they already gave. Map garage/yard/amenities to must_have_features. Map cash/financing/pre-approved to financing_status — never purchase_timeframe. Map when they want to buy to purchase_timeframe only. "
        : "";

    super(
      agentTaskSuperOptions(
        {
          instructions:
            `Collect exactly one field: ${field.label}. ` +
            `Ask naturally: ${question} ` +
            multiFieldHint +
            "When the caller answers, call record_schema_field_value.",
          tools: [recordPrimaryTool, ...additionalTools],
        },
        nestedTaskOptionsFromSession(sessionRef),
      ),
    );
  }

  async onEnter(): Promise<void> {
    const ud = this.sessionRef.userData;
    if (ud.callState) {
      const pending = this.handlers.pendingFields?.filter((f) => f.field_id !== this.field.field_id) ?? [];
      ud.callState = applyHeuristicIntakeBackfill({
        state: ud.callState,
        chatCtx: this.sessionRef.chatCtx,
        candidateFields: [this.field, ...pending],
      });
    }

    const existing = ud.callState?.collectedFields[this.field.field_id]?.trim();
    if (existing) {
      this.complete({ fieldId: this.field.field_id, value: existing });
      return;
    }

    const question =
      this.field.collection_instruction?.trim() ||
      `Could I get your ${this.field.label}?`;
    await this.session.generateReply({
      instructions: `Ask one short question to collect: ${question}. Ask only this one field — do not bundle other intake questions.`,
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
  return await task.run();
}
