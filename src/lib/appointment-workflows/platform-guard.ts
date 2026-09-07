import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { workflowMatchesAppointmentType } from "./conditions";
import { listActiveWorkflowsForTrigger } from "./service";

async function buildTypeNameToId(workspaceId: string): Promise<Map<string, string>> {
  const rows = await getPrisma().voiceService.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r: DbRow) => [r.name, r.id]));
}

/**
 * When a workspace has active appointment_booked workflows scoped to an appointment type,
 * platform default reminders (confirmation on book + 24h/2h scan) are skipped to avoid
 * duplicate customer messages. Workflow steps become the source of truth for that lifecycle.
 */
export async function shouldSkipPlatformRemindersForAppointment(
  workspaceId: string,
  serviceId?: string | null,
  serviceName?: string | null,
): Promise<boolean> {
  const workflows = await listActiveWorkflowsForTrigger(workspaceId, "appointment_booked");
  if (!workflows.length) return false;

  const typeMap = await buildTypeNameToId(workspaceId);
  return workflows.some((workflow) =>
    workflowMatchesAppointmentType(
      workflow.appointmentTypeScope,
      serviceId ?? null,
      serviceName ?? null,
      typeMap,
    ),
  );
}
