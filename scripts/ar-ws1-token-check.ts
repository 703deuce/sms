import { getPrisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/calendar/providers";
import type { CalendarConfig } from "@/lib/calendar/types";

async function main() {
  const ws = process.env.WORKSPACE_ID || "ws_1";
  const prisma = getPrisma();
  const rows = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: ws, provider: "microsoft" },
  });
  for (const c of rows) {
    const cfg = (c.config || {}) as CalendarConfig & Record<string, unknown>;
    console.log(
      JSON.stringify({
        id: c.id,
        status: c.status,
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
        hasAccess: Boolean(cfg.accessToken),
        hasRefresh: Boolean(cfg.refreshToken),
        expiresAt: cfg.expiresAt,
        lastTokenRefreshKind: cfg.lastTokenRefreshKind,
        lastTokenRefreshError: cfg.lastTokenRefreshError,
        importCount: cfg.importCalendarIds?.length ?? 0,
      }),
    );
    if (c.id === process.env.CONNECTION_ID || cfg.importCalendarIds?.length) {
      const token = await getValidAccessToken(c.id, "microsoft", cfg, {
        mutationSource: "manual_admin",
      });
      console.log("getValidAccessToken result:", token ? "ok" : "null");
      const after = await prisma.voiceCalendarConnection.findUnique({ where: { id: c.id } });
      console.log("status after refresh attempt:", after?.status);
    }
  }
  const recent = await prisma.voiceAppointment.findMany({
    where: { workspaceId: ws },
    orderBy: { startTime: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      startTime: true,
      status: true,
      externalId: true,
      updatedAt: true,
    },
  });
  console.log("\nRecent appointments:");
  for (const a of recent) {
    console.log(
      `${a.startTime?.toISOString()} | ${a.title} | ${a.status} | ext=${a.externalId?.slice(0, 20)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
