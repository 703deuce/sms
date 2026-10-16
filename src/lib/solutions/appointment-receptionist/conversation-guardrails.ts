import type { AppointmentReceptionistWizardState } from "./types";

/** Non-optional receptionist conversation rules — always enforced in prompts and saves. */
export const MANDATORY_CONVERSATION_BEHAVIORS: AppointmentReceptionistWizardState["conversationBehaviors"] =
  {
    keepBrief: true,
    oneQuestionAtATime: true,
    confirmDetails: true,
    neverInventPricing: true,
    neverInventAvailability: true,
  };

export function applyMandatoryConversationGuardrails(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  return {
    ...state,
    conversationBehaviors: { ...MANDATORY_CONVERSATION_BEHAVIORS },
  };
}
