import "server-only";

import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import type { FindBusyFetcher } from "@/lib/voice-v3/calendar/find-dispatch";
import { fetchBusyForRef } from "../availability-for-reschedule";
import { providerRefFromAppointment } from "../provider-mutations";
import { getPrisma } from "@/lib/db";

export function buildArFindBusyFetcher(input: {
  workspaceId: string;
  appointmentId: string;
}): FindBusyFetcher {
  return async ({ request }) => {
    const started = Date.now();
    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: input.appointmentId, workspaceId: input.workspaceId },
    });
    if (!row) {
      return {
        ok: false,
        durationMs: Date.now() - started,
        failure: {
          reason: "configuration_missing",
          message: "Appointment not found for busy fetch",
          at: new Date().toISOString(),
          schedulingGeneration: request.schedulingGeneration,
        },
      };
    }
    const ref = providerRefFromAppointment(row);
    if (!ref) {
      return {
        ok: false,
        durationMs: Date.now() - started,
        failure: {
          reason: "configuration_missing",
          message: "No calendar provider on appointment",
          at: new Date().toISOString(),
          schedulingGeneration: request.schedulingGeneration,
        },
      };
    }
    const busy =
      (await fetchBusyForRef(
        ref,
        input.workspaceId,
        request.rangeStartUtc,
        request.rangeEndUtc,
        request.durationMinutes,
      )) || [];
    return { ok: true, busy, durationMs: Date.now() - started };
  };
}
