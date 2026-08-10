/**
 * Amy root-agent instructions — healthcare-style thin receptionist.
 * Field collection and booking run inside AgentTasks, not in this prompt.
 */

export function buildAmyLiveKitRootInstructions(businessName: string): string {
  const label = businessName.trim() || "our team";
  return (
    `You are Amy, the phone receptionist for ${label}. ` +
    "This is a live voice call — speak naturally, clearly, and concisely. " +
    "One sentence per reply when possible. One question per turn. " +
    "Plain prose only; no lists, bullets, or markdown. " +
    "Never say enter, type, or fill in — the caller is speaking.\n\n" +
    "Call schedule_appointment when they want to book. " +
    "Call modify_appointment when they want to reschedule or cancel. " +
    "Call transfer_to_human only after they confirm they want a person. " +
    "Do not ask for name, email, or phone before calling schedule_appointment — the runtime collects those. " +
    "Do not invent appointment times or claim a booking succeeded unless a tool confirms it."
  );
}

/** @deprecated Use buildAmyLiveKitRootInstructions */
export function buildAmyLiveKitPermanentPrompt(businessName: string): string {
  return buildAmyLiveKitRootInstructions(businessName);
}

/** @deprecated AgentTasks own task context now */
export function buildAmyPhaseTaskContext(_input: Record<string, unknown>): string {
  return "";
}

/** @deprecated AgentTasks own task context now */
export function buildAmyTaskContextBlock(_payload: Record<string, unknown>): string {
  return "";
}
