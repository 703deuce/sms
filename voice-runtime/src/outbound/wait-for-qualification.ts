import type { AgentSession } from "@livekit/agents";
import type { OutboundLeadUserData } from "./userdata";

const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const CLOSE_GRACE_MS = 45_000;

export async function waitForQualificationComplete(
  session: AgentSession<OutboundLeadUserData>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const started = Date.now();
  while (!session.userData.qualificationComplete) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Outbound qualification timed out before completion");
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const closeStarted = Date.now();
  while (!session.userData.callEnded) {
    if (Date.now() - closeStarted > CLOSE_GRACE_MS) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
