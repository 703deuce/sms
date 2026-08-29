import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export type VoiceOutboxJob = {
  workspaceId: string;
  callId?: string;
  jobType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

/** Secondary / non-critical work off the live voice path. */
export async function enqueueVoiceOutbox(job: VoiceOutboxJob): Promise<void> {
  await enqueueJob({
    jobType: job.jobType,
    queueName: "voice-calls",
    workspaceId: job.workspaceId,
    payload: {
      ...job.payload,
      callId: job.callId || null,
      source: "voice_outbox",
    },
    idempotencyKey: job.idempotencyKey,
  });
}

export async function processVoiceOutboxJob(
  jobType: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (jobType) {
    case "voice_send_sms": {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      return sendQuickSms({
        workspaceId: String(payload.workspaceId),
        to: String(payload.to || ""),
        body: String(payload.body || ""),
        from: payload.from ? String(payload.from) : undefined,
        idempotencyKey: payload.operationId ? String(payload.operationId) : undefined,
      });
    }
    case "voice_appointment_provider_cancel": {
      const { getSchedulingProvider } = await import("@/lib/voice/providers/scheduling-provider");
      const provider = await getSchedulingProvider(String(payload.workspaceId));
      await provider.cancelAppointment(
        String(payload.externalId || ""),
        payload.reason ? String(payload.reason) : undefined,
      );
      return { ok: true, cancelled: true };
    }
    case "voice_appointment_provider_reschedule": {
      const { getSchedulingProvider } = await import("@/lib/voice/providers/scheduling-provider");
      const provider = await getSchedulingProvider(String(payload.workspaceId));
      await provider.rescheduleAppointment(
        String(payload.externalId || ""),
        String(payload.newStartTime || ""),
        String(payload.timezone || "America/New_York"),
      );
      return { ok: true, rescheduled: true };
    }
    default:
      return { ok: false, error: `Unknown outbox job: ${jobType}` };
  }
}
