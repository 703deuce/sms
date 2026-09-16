import * as ai from "./ai-client";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_CANCEL_TELNYX_TOOL_NAME,
  VOICE_V2_FIND_EXISTING_TELNYX_TOOL_NAME,
  VOICE_V2_RESCHEDULE_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME,
  VOICE_V2_SEARCH_KNOWLEDGE_TELNYX_TOOL_NAME,
  VOICE_V2_TRANSFER_CALL_TELNYX_TOOL_NAME,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TELNYX_TOOL_NAME,
} from "@/lib/voice-v2/telnyx-tool-definition";

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

export async function resolveVoiceV2SharedToolIds(): Promise<VoiceV2SharedToolIds> {
  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  return {
    findId: tools.find((t) => t.display_name === VOICE_V2_TELNYX_TOOL_NAME)?.id || null,
    bookId: tools.find((t) => t.display_name === VOICE_V2_BOOK_TELNYX_TOOL_NAME)?.id || null,
    saveIntakeId:
      tools.find((t) => t.display_name === VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME)?.id || null,
    findExistingId:
      tools.find((t) => t.display_name === VOICE_V2_FIND_EXISTING_TELNYX_TOOL_NAME)?.id || null,
    rescheduleId:
      tools.find((t) => t.display_name === VOICE_V2_RESCHEDULE_TELNYX_TOOL_NAME)?.id || null,
    cancelId: tools.find((t) => t.display_name === VOICE_V2_CANCEL_TELNYX_TOOL_NAME)?.id || null,
    finalizeRequestId:
      tools.find((t) => t.display_name === VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME)
        ?.id || null,
    sendBookingLinkId:
      tools.find((t) => t.display_name === VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME)?.id ||
      null,
    searchKnowledgeId:
      tools.find((t) => t.display_name === VOICE_V2_SEARCH_KNOWLEDGE_TELNYX_TOOL_NAME)?.id ||
      null,
    transferCallId:
      tools.find((t) => t.display_name === VOICE_V2_TRANSFER_CALL_TELNYX_TOOL_NAME)?.id || null,
    createCallbackId:
      tools.find((t) => t.display_name === VOICE_V2_CREATE_CALLBACK_REQUEST_TELNYX_TOOL_NAME)
        ?.id || null,
  };
}

export function mergeVoiceV2ToolIds(base: string[], v2: VoiceV2SharedToolIds): string[] {
  return [
    ...new Set(
      [
        ...base,
        v2.findId,
        v2.bookId,
        v2.saveIntakeId,
        v2.findExistingId,
        v2.rescheduleId,
        v2.cancelId,
        v2.finalizeRequestId,
        v2.sendBookingLinkId,
        v2.searchKnowledgeId,
        v2.transferCallId,
        v2.createCallbackId,
      ].filter(Boolean) as string[],
    ),
  ];
}
