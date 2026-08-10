import type { AgentSession } from "@livekit/agents";
import { buildOutboundIntroLine } from "./outbound-messages";
import type { OutboundLeadUserData } from "./userdata";

/**
 * Speak the configured outbound opener verbatim via TTS (no LLM turn).
 * Prevents the callee's "Hello?" from interrupting or triggering a second intro.
 */
export async function deliverOutboundOpening(
  session: AgentSession<OutboundLeadUserData>,
): Promise<void> {
  const ud = session.userData;
  if (ud.openingDelivered) return;

  const intro = buildOutboundIntroLine(ud.qualification, ud.job.lead.leadName);

  session.clearUserTurn();

  const handle = session.say(intro, {
    allowInterruptions: false,
    addToChatCtx: true,
  });

  await handle.waitForPlayout();

  // Drop any "Hello?" / greeting captured during connect — do not answer it separately.
  session.clearUserTurn();

  ud.openingDelivered = true;
}
