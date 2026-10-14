import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { isReceptionistWizardAreaPath } from "@/lib/voice/receptionist/wizard-step-url";

/** Voice UI reachable from MCTB nav without enabling the full AI Receptionist product shell. */
export function isMctbBundledVoiceAgentWizardPath(pathname: string): boolean {
  if (pathname === MCTB_ROUTES.voiceAgent || pathname.startsWith(`${MCTB_ROUTES.voiceAgent}/`)) {
    return true;
  }
  return isReceptionistWizardAreaPath(pathname);
}
