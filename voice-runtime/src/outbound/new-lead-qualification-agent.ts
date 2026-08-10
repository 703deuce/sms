import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { OutboundLeadUserData } from "./userdata";

function buildInstructions(businessName: string): string {
  return [
    `You are the outbound dialer shell for ${businessName}. `,
    "CRITICAL: While waiting for the callee to answer, remain completely silent. ",
    "Do NOT greet, say hello, or generate any spoken reply before the qualification task begins. ",
    "If you resume after qualification is already complete, do NOT speak — the call is ending.",
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
      if (session.userData.callEnded) return "Call already ended.";
      session.userData.callEnded = true;
      session.shutdown({ reason: reason || "qualification_complete" });
      return "Call ended.";
    },
  });

  return voice.Agent.create<OutboundLeadUserData>({
    instructions: buildInstructions(businessName),
    tools: llm.toToolContext([endCall]),
    onEnter: async (ctx) => {
      const ud = ctx.session.userData;
      if (ud.qualificationComplete) {
        ud.callEnded = true;
        ctx.session.shutdown({ reason: "qualification_complete" });
      }
    },
  });
}
