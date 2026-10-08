/** OpenAI model for Appointment Reminders SMS AI Rescheduler (not Voice V3). */
export const AR_AI_RESCHEDULER_MODEL_ID = "gpt-6-luna";

export function getArAiReschedulerModelId(): string {
  const configured = process.env.AR_AI_RESCHEDULER_MODEL?.trim();
  return configured || AR_AI_RESCHEDULER_MODEL_ID;
}

export function arAiReschedulerModelOptions(): { model: string } {
  return { model: getArAiReschedulerModelId() };
}
