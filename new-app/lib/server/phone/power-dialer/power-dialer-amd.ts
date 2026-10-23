import { randomUUID } from "crypto";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { telnyxCallControlPath } from "@/lib/server/phone/telnyx-call-actions";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

/** Telnyx premium / standard AMD result strings we map in answer-detection. */
export const TELNYX_AMD_RESULTS = [
  "human",
  "human_residence",
  "human_business",
  "machine",
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
  "fax_detected",
  "silence",
  "not_sure",
] as const;

/**
 * Start AMD on an existing outbound Call Control leg (linked from WebRTC).
 * WebRTC `newCall` does not accept AMD flags; detection must be started server-side on the control id.
 */
export async function startPowerDialerAmdOnCallControlLeg(input: {
  telnyxCallControlId: string;
  workspaceId: string;
  humanCallId: string;
  powerDialerAttemptId?: string | null;
  premium?: boolean;
}) {
  if (!isTelnyxPhoneConfigured()) {
    return { started: false, reason: "telnyx_not_configured" as const };
  }
  const controlId = input.telnyxCallControlId.trim();
  if (!controlId) return { started: false, reason: "no_control_id" as const };

  const clientState = Buffer.from(
    JSON.stringify({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      kind: "human",
      powerDialerAttemptId: input.powerDialerAttemptId ?? null,
    }),
  ).toString("base64");

  const body: Record<string, unknown> = {
    client_state: clientState,
    command_id: `pd_amd_${randomUUID()}`,
  };
  if (input.premium) {
    body.detection_mode = "Premium";
  }

  try {
    await telnyxRequest(telnyxCallControlPath(controlId, "/actions/answering_machine_detection_start"), {
      method: "POST",
      body,
    });
    phoneServerLog("power-dialer-amd", "amd_start_ok", {
      humanCallId: input.humanCallId,
      premium: Boolean(input.premium),
    });
    return { started: true as const };
  } catch (err) {
    phoneServerLog("power-dialer-amd", "amd_start_failed", {
      humanCallId: input.humanCallId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { started: false, reason: "telnyx_error" as const };
  }
}
