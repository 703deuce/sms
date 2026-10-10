import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { workflowMatchesAppointmentType } from "@/lib/appointment-workflows/conditions";
import { listActiveWorkflowsForTrigger } from "@/lib/appointment-workflows/service";

export type PlatformReminderWorkflowConflict = {
  blocked: boolean;
  workflowNames: string[];
  detail: string | null;
};

async function buildTypeNameToId(workspaceId: string): Promise<Map<string, string>> {
  const rows = await getPrisma().voiceService.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r: DbRow) => [r.name, r.id]));
}

export type PlatformReminderWorkflowContext = {
  workflows: Awaited<ReturnType<typeof listActiveWorkflowsForTrigger>>;
  typeMap: Map<string, string>;
};

export async function loadPlatformReminderWorkflowContext(
  workspaceId: string,
): Promise<PlatformReminderWorkflowContext> {
  const [workflows, typeMap] = await Promise.all([
    listActiveWorkflowsForTrigger(workspaceId, "appointment_booked"),
    buildTypeNameToId(workspaceId),
  ]);
  return { workflows, typeMap };
}

export function describePlatformReminderWorkflowConflictFromContext(
  ctx: PlatformReminderWorkflowContext,
  serviceId?: string | null,
  serviceName?: string | null,
): PlatformReminderWorkflowConflict {
  if (!ctx.workflows.length) {
    return { blocked: false, workflowNames: [], detail: null };
  }

  const matching = ctx.workflows.filter((workflow) =>
    workflowMatchesAppointmentType(
      workflow.appointmentTypeScope,
      serviceId ?? null,
      serviceName ?? null,
      ctx.typeMap,
    ),
  );

  if (!matching.length) {
    return { blocked: false, workflowNames: [], detail: null };
  }

  const names = matching.map((w) => w.name || "Automation").filter(Boolean);
  const label = names.length === 1 ? names[0] : names.join(", ");
  return {
    blocked: true,
    workflowNames: names,
    detail: `Automated workflow “${label}” sends messages when appointments are booked, so default Appointment Reminders are not sent for this appointment type.`,
  };
}

export async function describePlatformReminderWorkflowConflict(
  workspaceId: string,
  serviceId?: string | null,
  serviceName?: string | null,
): Promise<PlatformReminderWorkflowConflict> {
  const ctx = await loadPlatformReminderWorkflowContext(workspaceId);
  return describePlatformReminderWorkflowConflictFromContext(ctx, serviceId, serviceName);
}
