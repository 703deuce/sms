import "server-only";

import { cancelPlatformAppointment } from "@/lib/appointments/booking-platform";
import { cancelProviderEvent } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";

/** Cancel on connected calendar (when linked) then update Transovo appointment record. */
export async function commitPublicSelfServiceCancel(input: {
  workspaceId: string;
  appointmentId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const provider = await cancelProviderEvent({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    reason: "Customer canceled via self-service link",
  });
  if (!provider.ok) {
    return { ok: false, message: provider.message };
  }
  await cancelPlatformAppointment(input.workspaceId, input.appointmentId, "customer");
  return { ok: true };
}
