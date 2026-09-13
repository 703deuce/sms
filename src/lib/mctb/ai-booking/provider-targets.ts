import { getPrisma } from "@/lib/db";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { integrationFetch } from "@/lib/integrations/framework/http";

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
      const me = await integrationFetch<{ resource?: { uri?: string } }>(
        "https://api.calendly.com/users/me",
        { accessToken: ctx.accessToken },
      );
      const owner = me.resource?.uri;
      if (!owner) return [];
      const res = await integrationFetch<{
        collection?: Array<{ uri?: string; name?: string; duration?: number }>;
      }>(`https://api.calendly.com/event_types?user=${encodeURIComponent(owner)}&active=true`, {
        accessToken: ctx.accessToken,
      });
      return (res.collection || []).map((et) => ({
        id: String(et.uri || ""),
        label: String(et.name || "Event type"),
        meta: et.duration ? `${et.duration} min` : undefined,
      }));
    } catch {
      return [];
    }
  }

  return [];
}
