import 'server-only'

/** Clips talking-mode LLM id (matches appointment-reminders gpt-6-luna pattern). */
export const CLIPS_LLM_MODEL_ID = 'gpt-6-luna'

export function getClipsLlmModelId(): string {
  const configured = process.env.CLIP_LLM_MODEL?.trim() || process.env.AR_AI_RESCHEDULER_MODEL?.trim()
  return configured || CLIPS_LLM_MODEL_ID
}
