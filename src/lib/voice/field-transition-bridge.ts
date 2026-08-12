/**
 * Rules for non-interactive bridge speech during field/task transitions.
 * Only the active field collection task may ask or solicit the next field.
 */
export const FIELD_TRANSITION_BRIDGE_RULES =
  "Field transition speech may only acknowledge the caller's previous answer or provide a short neutral transition while the next field loads. " +
  "It must never ask questions, solicit information, preview upcoming fields, list future questions, or use phrasing like " +
  "'tell me', 'let me know', 'what about', or 'how about'. " +
  "Only the active field collection task may ask the next required question.";

export const FIELD_ANSWER_ACK_RULES =
  "When the caller answers, you may use one brief non-interactive acknowledgment (one sentence max) before calling the record tool. " +
  "Do not ask questions or mention upcoming fields.";
