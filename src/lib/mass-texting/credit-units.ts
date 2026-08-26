/** Messaging credits consumed per outbound unit (canonical). */
export const MASS_TEXT_MMS_CREDITS_PER_MESSAGE = 3;

export function estimateMessagingCredits(input: {
  recipientCount: number;
  smsSegmentsPerRecipient: number;
  isMms: boolean;
}): number {
  if (input.recipientCount <= 0) return 0;
  if (input.isMms) {
    return input.recipientCount * MASS_TEXT_MMS_CREDITS_PER_MESSAGE;
  }
  return input.recipientCount * Math.max(1, input.smsSegmentsPerRecipient);
}
