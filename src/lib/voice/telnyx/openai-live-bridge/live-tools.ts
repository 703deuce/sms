/**
 * Live Responses function tools — copied from Realtime OpenAI-facing definitions.
 * Does not import realtime-tools.ts (frozen Realtime route must stay isolated).
 */
import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_CANCEL_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_FIND_EXISTING_TOOL_TYPE,
  VOICE_V2_RESCHEDULE_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
  VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
  VOICE_V2_BOOK_OFFERED_SLOT_BODY,
  VOICE_V2_CANCEL_BODY,
  VOICE_V2_CREATE_CALLBACK_REQUEST_BODY,
  VOICE_V2_FINALIZE_CALLER_REQUEST_BODY,
  VOICE_V2_FIND_AVAILABILITY_BODY,
  VOICE_V2_FIND_EXISTING_BODY,
  VOICE_V2_RESCHEDULE_BODY,
  VOICE_V2_SAVE_INTAKE_BODY,
  VOICE_V2_SEARCH_KNOWLEDGE_BODY,
  VOICE_V2_SEND_BOOKING_LINK_BODY,
  VOICE_V2_TRANSFER_CALL_BODY,
} from "@/lib/voice-v2/telnyx-tool-definition";
import {
  buildVoiceV2CallCapabilitySnapshot,
} from "@/lib/voice-v2/workflow-capability";
import { isVoiceV2KnowledgeSearchEnabled } from "@/lib/voice-v2/knowledge-config";

export type LiveResponsesFunctionTool = {
  type: "function";
  name: string;
  description: string;
  strict: boolean;
  parameters: Record<string, unknown>;
};

function fnTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): LiveResponsesFunctionTool {
  return { type: "function", name, description, strict: true, parameters };
}

export function buildLiveVoiceTools(input: {
  config: VoiceAgentConfig;
  transferEnabled?: boolean;
}): LiveResponsesFunctionTool[] {
  const snap = buildVoiceV2CallCapabilitySnapshot(input.config);
  const tools: LiveResponsesFunctionTool[] = [];

  if (snap.intakeToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
        "Save enabled intake field values the caller provided. Not for booking intent alone or date/time alone.",
        VOICE_V2_SAVE_INTAKE_BODY as Record<string, unknown>,
      ),
    );
  }

  if (snap.findToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
        "Structured FIND_AVAILABILITY — send business-local date and time window. Only state slots returned.",
        VOICE_V2_FIND_AVAILABILITY_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
        "Book using offer_set_id and selected_slot_id from FIND. Only say confirmed after BOOKING_CONFIRMED.",
        VOICE_V2_BOOK_OFFERED_SLOT_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_FIND_EXISTING_TOOL_TYPE,
        "Find caller's existing appointment for reschedule or cancel.",
        VOICE_V2_FIND_EXISTING_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_RESCHEDULE_TOOL_TYPE,
        "Reschedule to a canonical offered slot.",
        VOICE_V2_RESCHEDULE_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_CANCEL_TOOL_TYPE,
        "Cancel after caller explicitly confirmed.",
        VOICE_V2_CANCEL_BODY as Record<string, unknown>,
      ),
    );
  }

  if (snap.finalizeToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
        "Finalize a caller request for the business when not live booking.",
        VOICE_V2_FINALIZE_CALLER_REQUEST_BODY as Record<string, unknown>,
      ),
    );
  }

  if (snap.sendBookingLinkToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
        "Text booking link after verbal SMS consent.",
        VOICE_V2_SEND_BOOKING_LINK_BODY as Record<string, unknown>,
      ),
    );
  }

  if (isVoiceV2KnowledgeSearchEnabled(input.config)) {
    tools.push(
      fnTool(
        VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
        "Search indexed business documents when answer is not in prompt.",
        VOICE_V2_SEARCH_KNOWLEDGE_BODY as Record<string, unknown>,
      ),
    );
  }

  if (input.transferEnabled) {
    tools.push(
      fnTool(
        VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
        "Transfer to a human when caller requests and policy allows.",
        VOICE_V2_TRANSFER_CALL_BODY as Record<string, unknown>,
      ),
    );
  }

  tools.push(
    fnTool(
      VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
      "Create a callback request when caller prefers callback.",
      VOICE_V2_CREATE_CALLBACK_REQUEST_BODY as Record<string, unknown>,
    ),
  );

  return tools;
}

/** @deprecated alias */
export const buildLiveDelegationTools = buildLiveVoiceTools;
