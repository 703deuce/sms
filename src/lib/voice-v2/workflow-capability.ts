import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "@/lib/voice-v2/telnyx-tool-definition";
import {
  isVoiceV2PstnLiveBookingMode,
  isVoiceV2PstnOneAmyMode,
  resolveVoiceV2BookingStrategy,
} from "@/lib/voice-v2/pstn-workflow-mode";

export const VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH = "VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH";

export const VOICE_V2_LIVE_BOOKING_TOOL_NAMES = [
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
] as const;

export const VOICE_V2_INTAKE_ONLY_TOOL_NAMES = [
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
] as const;

export const VOICE_V2_SEND_LINK_TOOL_NAMES = [
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME,
] as const;

/** @deprecated use VOICE_V2_LIVE_BOOKING_TOOL_NAMES */
export const VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES = VOICE_V2_LIVE_BOOKING_TOOL_NAMES;

export type VoiceV2CallCapabilitySnapshot = {
  bookingStrategy: ReturnType<typeof resolveVoiceV2BookingStrategy>;
  voiceV2LiveBooking: boolean;
  voiceV2OneAmy: boolean;
  intakeToolAvailable: boolean;
  findToolAvailable: boolean;
  bookToolAvailable: boolean;
  finalizeToolAvailable: boolean;
  sendBookingLinkToolAvailable: boolean;
  capturedAt: string;
};

export function expectedVoiceV2LiveBooking(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  return isVoiceV2PstnLiveBookingMode(config);
}

/** Immutable per-call snapshot from agent config only (no Telnyx round-trip). */
export function buildVoiceV2CallCapabilitySnapshot(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): VoiceV2CallCapabilitySnapshot {
  const strategy = resolveVoiceV2BookingStrategy(config);
  const live = strategy === "MICROSOFT_365" || strategy === "CALENDLY";
  const oneAmy = isVoiceV2PstnOneAmyMode(config);
  return {
    bookingStrategy: strategy,
    voiceV2LiveBooking: live,
    voiceV2OneAmy: oneAmy,
    intakeToolAvailable: oneAmy,
    findToolAvailable: live,
    bookToolAvailable: live,
    finalizeToolAvailable: oneAmy && strategy !== "SEND_LINK",
    sendBookingLinkToolAvailable: strategy === "SEND_LINK",
    capturedAt: new Date().toISOString(),
  };
}

export type TelnyxWorkflowReadBack = {
  tool_ids: string[];
  generalNode?: {
    id?: string;
    shared_tool_ids?: string[];
    instructions?: string;
  } | null;
  liveBookingNode?: {
    id?: string;
    shared_tool_ids?: string[];
    instructions?: string;
  } | null;
  displayNameByToolId: Map<string, string>;
};

function toolNamesOnNode(
  readBack: TelnyxWorkflowReadBack,
  node?: { shared_tool_ids?: string[] } | null,
): string[] {
  return (node?.shared_tool_ids || [])
    .map((id) => readBack.displayNameByToolId.get(id) || "")
    .filter(Boolean);
}

export function verifyVoiceV2WorkflowReadBack(input: {
  expectedVoiceV2Booking: boolean;
  expectedOneAmyIntake?: boolean;
  expectedOneAmySendLink?: boolean;
  readBack: TelnyxWorkflowReadBack;
}): { ok: true } | { ok: false; code: string; detail: string } {
  const generalNames = toolNamesOnNode(input.readBack, input.readBack.generalNode);
  const liveNames = toolNamesOnNode(input.readBack, input.readBack.liveBookingNode);
  const allNodeNames = [...generalNames, ...liveNames];

  const hasLiveTool = allNodeNames.some((n) =>
    (VOICE_V2_LIVE_BOOKING_TOOL_NAMES as readonly string[]).includes(n),
  );
  const hasFindOrBook = allNodeNames.some(
    (n) => n === VOICE_V2_TELNYX_TOOL_NAME || n === VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  );

  if (!input.expectedVoiceV2Booking) {
    if (hasFindOrBook) {
      return {
        ok: false,
        code: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
        detail: "find_book_tools_present_but_live_booking_disabled",
      };
    }
    if (input.expectedOneAmySendLink) {
      for (const required of VOICE_V2_SEND_LINK_TOOL_NAMES) {
        if (!generalNames.includes(required)) {
          return {
            ok: false,
            code: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
            detail: `missing_send_link_tool:${required}`,
          };
        }
      }
    } else if (input.expectedOneAmyIntake) {
      for (const required of VOICE_V2_INTAKE_ONLY_TOOL_NAMES) {
        if (!generalNames.includes(required)) {
          return {
            ok: false,
            code: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
            detail: `missing_intake_tool:${required}`,
          };
        }
      }
    } else if (hasLiveTool) {
      return {
        ok: false,
        code: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
        detail: "v2_tools_present_but_config_disabled",
      };
    }
    return { ok: true };
  }

  const missing: string[] = [];
  const toolIdSet = new Set(input.readBack.tool_ids || []);
  for (const displayName of VOICE_V2_LIVE_BOOKING_TOOL_NAMES) {
    const hasOnAssistant = [...toolIdSet].some(
      (id) => input.readBack.displayNameByToolId.get(id) === displayName,
    );
    if (!hasOnAssistant) missing.push(`${displayName}:assistant_tool_ids`);
  }

  const general = input.readBack.generalNode;
  if (!general?.shared_tool_ids?.length) {
    missing.push("n_general:missing_v2_tools");
  } else {
    for (const displayName of VOICE_V2_LIVE_BOOKING_TOOL_NAMES) {
      const onNode = general.shared_tool_ids.some(
        (id) => input.readBack.displayNameByToolId.get(id) === displayName,
      );
      if (!onNode) missing.push(`${displayName}:general_node`);
    }
  }

  const live = input.readBack.liveBookingNode;
  const liveIds = live?.shared_tool_ids || [];
  const v2OnLiveNode = liveIds.some((id) => {
    const name = input.readBack.displayNameByToolId.get(id) || "";
    return (VOICE_V2_LIVE_BOOKING_TOOL_NAMES as readonly string[]).includes(name);
  });
  if (v2OnLiveNode) {
    missing.push("n_live_booking:v2_tools_must_not_be_on_handoff_node");
  }

  const generalInstr = String(general?.instructions || "").toLowerCase();
  if (
    generalInstr.includes("move to the live booking node") ||
    generalInstr.includes("hand off to live booking")
  ) {
    missing.push("general_instructions:booking_handoff_language");
  }
  if (
    (generalInstr.includes("don't have live booking") ||
      generalInstr.includes("do not have live booking")) &&
    !generalInstr.includes("live calendar booking is available on this call")
  ) {
    missing.push("general_instructions:denies_live_booking");
  }

  if (missing.length) {
    return {
      ok: false,
      code: VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH,
      detail: missing.join(","),
    };
  }
  return { ok: true };
}
