import { redirect } from "next/navigation";
import { receptionistEditStepHref } from "@/lib/voice/receptionist/wizard-step-url";

/**
 * MCTB sidebar entry — opens the Opus AI Voice Agent setup wizard (not the legacy agents list).
 */
export default function MctbVoiceAgentLegacyRedirect() {
  redirect(receptionistEditStepHref("goals"));
}
