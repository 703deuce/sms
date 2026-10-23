import { randomUUID } from "crypto";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { telnyxCallControlPath } from "@/lib/server/phone/telnyx-call-actions";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { resolvePowerDialerAmdStartPlan } from "./amd-policy";
import { getPrisma } from "@/lib/server/db";
import { mergeAttemptMetadata, readAttemptMetadata } from "./attempt-metadata";

/** Telnyx premium / standard AMD result strings we map in answer-classification. */
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
 * WebRTC `newCall` does not accept dial-time AMD flags; detection is started server-side.
 * iOS screening: Telnyx documents `premium_ios_call_screening_detection` on POST /v2/calls;
 * we request `PremiumCallScreening` on AMD-start when workspace screening is enabled.
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

  const plan = await resolvePowerDialerAmdStartPlan({
    workspaceId: input.workspaceId,
    powerDialerAttemptId: input.powerDialerAttemptId,
  });

  if (!plan.shouldStart) {
    phoneServerLog("power-dialer-amd", "amd_start_skipped", {
      humanCallId: input.humanCallId,
      reason: plan.reason,
    });
    return { started: false, reason: plan.reason as "telnyx_not_configured" };
  }

  if (input.powerDialerAttemptId) {
    const prisma = getPrisma();
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.powerDialerAttemptId, workspaceId: input.workspaceId },
    });
    const meta = readAttemptMetadata(attempt?.metadataJson);
    if (meta.amdSessionStarted) {
      return { started: false, reason: "already_started" as const };
    }
    if (attempt) {
      await prisma.powerDialerAttempt.update({
        where: { id: input.powerDialerAttemptId },
        data: {
          metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
            amdSessionStarted: true,
            amdDetectionMode: plan.detectionMode,
            amdBillingTier: plan.billingTier,
            iosScreeningRequested: plan.iosScreeningRequested,
            connectionPhase: "checking_answer",
          }),
        },
      });
    }
  }

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
  if (plan.amdStartDetectionMode) {
    body.detection_mode = plan.amdStartDetectionMode;
  } else if (input.premium) {
    body.detection_mode = "Premium";
  }
  if (plan.promptEndTimeoutMillis && plan.amdStartDetectionMode === "PremiumCallScreening") {
    body.answering_machine_detection_config = {
      prompt_end_timeout_millis: plan.promptEndTimeoutMillis,
      total_analysis_time_millis: 30_000,
      greeting_duration_millis: 2_000,
    };
  }

  try {
    await telnyxRequest(telnyxCallControlPath(controlId, "/actions/answering_machine_detection_start"), {
      method: "POST",
      body,
    });
    phoneServerLog("power-dialer-amd", "amd_start_ok", {
      humanCallId: input.humanCallId,
      detectionMode: plan.detectionMode,
      amdStartDetectionMode: plan.amdStartDetectionMode,
    });
    return { started: true as const, plan };
  } catch (err) {
    phoneServerLog("power-dialer-amd", "amd_start_failed", {
      humanCallId: input.humanCallId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { started: false, reason: "telnyx_error" as const };
  }
}
