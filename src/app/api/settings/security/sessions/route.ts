import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const logs = await prisma.auditLog.findMany({
      where: {
        userId: auth.session.userId,
        event: { in: ["login", "session_start", "password_changed"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const sessions = logs.map((log: { id: string; detail: string | null; event: string; createdAt: Date }, i: number) => ({
      id: log.id,
      device: log.detail || log.event,
      location: "—",
      lastActive: log.createdAt.toISOString(),
      current: i === 0 && log.event === "login",
    }));

    if (sessions.length === 0) {
      sessions.push({
        id: "current",
        device: "Current browser session",
        location: "—",
        lastActive: new Date().toISOString(),
        current: true,
      });
    }

    return NextResponse.json({ data: sessions });
  } catch (err) {
    return jsonError(err, 500);
  }
}
