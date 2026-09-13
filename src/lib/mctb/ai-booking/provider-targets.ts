import { getPrisma } from "@/lib/db";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { listCalendlyEventTypes } from "@/lib/integrations/adapters/calendly-event-types";

export type SchedulingTargetOption = {
  id: string;
  label: string;
  meta?: string;
};

export async function listMctbAiBookingSchedulingTargets(
  workspaceId: string,
  provider: string,
): Promise<SchedulingTargetOption[]> {
  if (provider === "microsoft") {
    const prisma = getPrisma();
    const rows = await prisma.voiceCalendarConnection.findMany({
      where: { workspaceId, provider: "microsoft", status: "connected" },
      orderBy: { createdAt: "asc" },
    });
    const services = await prisma.voiceService.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      take: 50,
    });
    const calendars = rows.map((r) => ({
      id: r.id,
      label: String((r.config as { email?: string })?.email || r.id),
      meta: "Microsoft calendar",
    }));
    const svc = services.map((s) => ({
      id: s.name,
      label: s.name,
      meta: `${s.durationMinutes || 30} min`,
    }));
    return [...calendars, ...svc];
  }

  if (provider === "calendly") {
    try {
      const ctx = await buildAdapterContext(workspaceId, "calendly");
      const types = await listCalendlyEventTypes(ctx, { activeOnly: true });
      return types.map((et) => ({
        id: et.uri,
        label: et.name,
        meta: `${et.durationMinutes} min`,
      }));
    } catch {
      return [];
    }
  }

  return [];
}
