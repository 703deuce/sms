/** Legacy Telnyx Voice V2 shared tool IDs — booking tools no longer registered. */
export type VoiceV2SharedToolIds = {
  findId: string | null;
  bookId: string | null;
  saveIntakeId: string | null;
  findExistingId: string | null;
  rescheduleId: string | null;
  cancelId: string | null;
  finalizeRequestId: string | null;
  sendBookingLinkId: string | null;
  searchKnowledgeId: string | null;
  transferCallId: string | null;
  createCallbackId: string | null;
};

export function mergeVoiceV2ToolIds(toolIds: string[], _v2: VoiceV2SharedToolIds): string[] {
  return toolIds;
}
