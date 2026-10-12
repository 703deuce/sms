import "server-only";

import { createId } from "@/lib/supabase/id";
import { commitArReschedule } from "@/lib/appointment-reminders/ai-rescheduler/commit-reschedule";

export async function commitPublicSelfServiceReschedule(input: {
  workspaceId: string;
  appointmentId: string;
  startsAt: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const operationId = `public-${createId()}`;
  return commitArReschedule({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    startsAt: input.startsAt,
    initiatedBy: "customer",
    operationId,
    skipModeCheck: true,
  });
}
