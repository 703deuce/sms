import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "@/lib/voice-v2/telnyx-tool-definition";
import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";

export const VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH = "VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH";

export const VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES = [
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
] as const;

export type VoiceV2CallCapabilitySnapshot = {
  voiceV2LiveBooking: boolean;
  intakeToolAvailable: boolean;
  findToolAvailable: boolean;
  bookToolAvailable: boolean;
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
  const on = expectedVoiceV2LiveBooking(config);
  return {
    voiceV2LiveBooking: on,
    intakeToolAvailable: on,
    findToolAvailable: on,
    bookToolAvailable: on,
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

export function verifyVoiceV2WorkflowReadBack(input: {
  expectedVoiceV2Booking: boolean;
  readBack: TelnyxWorkflowReadBack;
}): { ok: true } | { ok: false; code: string; detail: string } {
  if (!input.expectedVoiceV2Booking) {
    const nodeIds = [
      ...(input.readBack.liveBookingNode?.shared_tool_ids || []),
      ...(input.readBack.generalNode?.shared_tool_ids || []),
    ];
    const hasV2OnNode = nodeIds.some((id) => {
      const name = input.readBack.displayNameByToolId.get(id) || "";
      return (VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES as readonly string[]).includes(name);
    });
    if (hasV2OnNode) {
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
  for (const displayName of VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES) {
    const hasOnAssistant = [...toolIdSet].some(
      (id) => input.readBack.displayNameByToolId.get(id) === displayName,
    );
    if (!hasOnAssistant) missing.push(`${displayName}:assistant_tool_ids`);
  }

  const general = input.readBack.generalNode;
  if (!general?.shared_tool_ids?.length) {
    missing.push("n_general:missing_v2_tools");
  } else {
    for (const displayName of VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES) {
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
    return (VOICE_V2_REQUIRED_SHARED_DISPLAY_NAMES as readonly string[]).includes(name);
  });
  if (v2OnLiveNode) {
    missing.push("n_live_booking:v2_tools_must_not_be_on_handoff_node");
  }

  const generalInstr = String(general?.instructions || "").toLowerCase();
  if (
    generalInstr.includes("move to live booking") ||
    (generalInstr.includes("transfer") && generalInstr.includes("booking"))
  ) {
    missing.push("general_instructions:booking_handoff_language");
  }
  if (
    generalInstr.includes("don't have live booking") ||
    generalInstr.includes("do not have live booking")
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
