import type { AgentSession } from "@livekit/agents";
import { buildQualificationCloseLine } from "./outbound-messages";
import type { OutboundLeadUserData } from "./userdata";

/**
 * Speak the configured outbound close verbatim (no LLM improvisation).
 * Ensures realtime and stack agents deliver the same handoff line before hangup.
 */
export async function deliverOutboundClosing(
  session: AgentSession<OutboundLeadUserData>,
): Promise<void> {
  const ud = session.userData;
  if (ud.closingDelivered) return;

  const closeLine = buildQualificationCloseLine(
    ud.qualification,
    ud.job.lead.leadName,
  );

  session.clearUserTurn();

  const handle = session.say(closeLine, {
    allowInterruptions: false,
    addToChatCtx: true,
  });

  await handle.waitForPlayout();
  session.clearUserTurn();

  ud.closingDelivered = true;
}
