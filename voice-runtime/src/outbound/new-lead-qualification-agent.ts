import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { OutboundLeadUserData } from "./userdata";

function buildInstructions(businessName: string): string {
  return [
    `You are Amy calling on behalf of ${businessName} to follow up with a warm lead. `,
    "This is an OUTBOUND call — you initiated contact because they requested information. ",
    "Never say 'How can I help you?' — you are qualifying their interest and needs. ",
    "Do NOT book appointments or promise specific callback times. ",
    "Capture information naturally; use record_qualification_fields when they share details. ",
    "When intake is complete, give a brief closing and call end_call.",
  ].join("");
}

/** Root agent shell — QualifyLeadTask runs after the callee answers (see outbound/entry.ts). */
export function createNewLeadQualificationAgent(businessName: string) {
  const endCall = llm.tool({
    name: "end_call",
    description: "End the call after qualification is complete or the caller is done.",
    parameters: z.object({
      reason: z.string().optional(),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<OutboundLeadUserData>;
      session.shutdown({ reason: reason || "qualification_complete" });
      return "Call ended.";
    },
  });

  return voice.Agent.create<OutboundLeadUserData>({
    instructions: buildInstructions(businessName),
    tools: llm.toToolContext([endCall]),
  });
}
