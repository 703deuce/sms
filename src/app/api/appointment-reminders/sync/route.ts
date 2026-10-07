import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api-auth";
import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { getPrisma } from "@/lib/db";
import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const allConnections = await prisma.voiceCalendarConnection.findMany({
      where: {
        workspaceId: auth.workspaceId,
        provider: { in: ["google", "microsoft"] },
      },
      select: { id: true, status: true },
    });
    const connections = allConnections.filter((c) => isCalendarConnectionUsable(c.status));
    if (!connections.length) {
      return NextResponse.json({ error: "No calendar connected" }, { status: 400 });
    }
    const results = [];
    for (const conn of connections) {
      const stats = await syncWorkspaceCalendarConnection(auth.workspaceId, conn.id, {
        incremental: true,
        manual: true,
      });
      results.push({ connectionId: conn.id, stats });
    }
    return NextResponse.json({ data: { results } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
