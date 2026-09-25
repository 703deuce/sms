import { redirect } from "next/navigation";

/**
 * Legacy MCTB URL for Voice AI receptionist configuration.
 * Voice owns agent setup — not MCTB AI Recovery.
 */
export default function MctbVoiceAgentLegacyRedirect() {
  redirect("/voice/agents");
}
