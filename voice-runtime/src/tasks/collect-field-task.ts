import { llm, voice, workflows } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import type { AmyUserData } from "../metadata";
import { requireCallContext, stashCallContext } from "../call-context";
import { missingRequiredFields, recordCallerField } from "../scheduling-bridge";

export type CollectedFieldResult = {
  fieldId: string;
  value: string;
};

function buildRecordFieldTool(
  field: RuntimeFieldManifestEntry,
  sessionRef: AgentSession<AmyUserData>,
  onComplete: (result: CollectedFieldResult) => void,
) {
  return llm.tool({
    name: "record_field",
    description: `Record the caller's ${field.label}.`,
    parameters: z.object({
      value: z.string().describe(`The caller's ${field.label}`),
    }),
    execute: async ({ value }) => {
      let ctx = requireCallContext(sessionRef);
      const { ctx: nextCtx, result } = await recordCallerField(ctx, value, field.field_id);
      ctx = nextCtx;
      stashCallContext(sessionRef, ctx);
      if (!result.ok) {
        throw new llm.ToolError(result.speak || "I couldn't save that.");
      }
      onComplete({ fieldId: field.field_id, value });
      return "Saved.";
    },
  });
}

export class CollectFieldTask extends voice.AgentTask<CollectedFieldResult> {
  constructor(
    private readonly field: RuntimeFieldManifestEntry,
    private readonly sessionRef: AgentSession<AmyUserData>,
  ) {
    super({
      instructions:
        `Collect the caller's ${field.label}. ` +
        `${field.collection_instruction || "Ask naturally and record only what they say."}`,
      tools: [
        buildRecordFieldTool(field, sessionRef, (result) => this.complete(result)),
      ],
    });
  }

  async onEnter(): Promise<void> {
    await this.session.generateReply({
      instructions: `Ask for their ${this.field.label}. One short question only.`,
    });
  }
}

export async function runCollectCallerFieldsTaskGroup(
  session: AgentSession<AmyUserData>,
): Promise<LiveKitCallContext> {
  let ctx = requireCallContext(session);
  const fields = missingRequiredFields(ctx);
  if (!fields.length) return ctx;

  const group = new workflows.TaskGroup({ summarizeChatCtx: false });
  for (const field of fields) {
    group.add(() => new CollectFieldTask(field, session), {
      id: field.field_id,
      description: `Collect ${field.label}`,
    });
  }

  await group.run();
  return requireCallContext(session);
}
