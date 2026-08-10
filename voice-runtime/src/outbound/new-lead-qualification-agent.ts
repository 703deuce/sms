import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { endOutboundCall } from "./end-outbound-call";
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
  return voice.Agent.create<OutboundLeadUserData>({
    instructions: buildInstructions(businessName),
    tools: {},
    onEnter: async (ctx) => {
      const ud = ctx.session.userData;
      if (ud.qualificationComplete || ud.callEnding || ud.callEnded) {
        await endOutboundCall(ctx.session as AgentSession<OutboundLeadUserData>, {
          source: "root_shell_resume",
        });
      }
    },
  });
}
