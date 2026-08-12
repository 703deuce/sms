/**
 * Rules for non-interactive bridge speech during field/task transitions.
 * Only the entering field task may speak (brief ack + its question).
 */
export const FIELD_TRANSITION_BRIDGE_RULES =
  "During field transitions, only the newly active field collection task may speak. " +
  "The finishing task must record silently via tools with no acknowledgment. " +
  "The entering task may use one short non-interactive acknowledgment plus its single field question. " +
  "Never ask questions, solicit information, preview upcoming fields, or list future questions in bridge speech.";
