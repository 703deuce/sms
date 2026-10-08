import "server-only";

import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import type { ExistingAppointment } from "@/lib/voice-v3/calendar/appointment-management-types";
import { createInitialVoiceV3CallContext, type VoiceV3CallContext } from "@/lib/voice-v3/state/call-context";
import { VoiceV3CallRuntime } from "@/lib/voice-v3/state/call-runtime";
import { buildVoiceV3CallClock } from "@/lib/voice-v3/time/call-clock";
import { loadWorkflowContext, saveWorkflowContext } from "./persist";

export async function ensureArRescheduleRuntime(input: {
  sessionId: string;
  workspaceId: string;
  appointmentId: string;
  config: VoiceV3AgentConfig;
  verifiedExisting: ExistingAppointment;
  lookupCompleted?: boolean;
}): Promise<{ runtime: VoiceV3CallRuntime; context: VoiceV3CallContext }> {
  const existing = await loadWorkflowContext(input.sessionId);
  const now = new Date();
  const clock = buildVoiceV3CallClock(input.config.timezone, now);

  let context: VoiceV3CallContext;
  if (existing) {
    context = existing;
  } else {
    context = createInitialVoiceV3CallContext({
      callId: `ar_sms_${input.sessionId}`,
      liveSessionId: input.sessionId,
      timezone: input.config.timezone,
      clock,
      now,
    });
    context = {
      ...context,
      dialog: { activeGoal: "RESCHEDULE_APPOINTMENT" },
      appointmentManagement: {
        ...context.appointmentManagement,
        verifiedExisting: input.verifiedExisting,
        lookupCompleted: input.lookupCompleted ?? true,
        reschedule: { phase: "NONE", attemptId: null },
      },
    };
    await saveWorkflowContext(input.sessionId, context);
  }

  const runtime = new VoiceV3CallRuntime({ config: input.config, context });
  return { runtime, context: runtime.getSnapshot() };
}

export async function persistArRescheduleRuntime(sessionId: string, runtime: VoiceV3CallRuntime): Promise<void> {
  await saveWorkflowContext(sessionId, runtime.getSnapshot());
}
