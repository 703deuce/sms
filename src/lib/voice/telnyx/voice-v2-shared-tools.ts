import * as ai from "./ai-client";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "@/lib/voice-v2/telnyx-tool-definition";

export type VoiceV2SharedToolIds = {
  findId: string | null;
  bookId: string | null;
  saveIntakeId: string | null;
};

export async function resolveVoiceV2SharedToolIds(): Promise<VoiceV2SharedToolIds> {
  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  return {
    findId: tools.find((t) => t.display_name === VOICE_V2_TELNYX_TOOL_NAME)?.id || null,
    bookId: tools.find((t) => t.display_name === VOICE_V2_BOOK_TELNYX_TOOL_NAME)?.id || null,
    saveIntakeId:
      tools.find((t) => t.display_name === VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME)?.id || null,
  };
}

export function mergeVoiceV2ToolIds(base: string[], v2: VoiceV2SharedToolIds): string[] {
  return [...new Set([...base, v2.findId, v2.bookId, v2.saveIntakeId].filter(Boolean) as string[])];
}
