import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { WizardStepId } from "@/lib/solutions/appointment-receptionist/types";
import { MCTB_VOICE_AGENT_STEP_QUERY } from "./wizard-steps";

/** Deep link into the MCTB voice agent wizard step (same persistence as Call Handling). */
export function mctbVoiceAgentStepHref(step: WizardStepId): string {
  const q = MCTB_VOICE_AGENT_STEP_QUERY[step] ?? step;
  return `${MCTB_ROUTES.voiceAgent}?step=${encodeURIComponent(q)}`;
}
