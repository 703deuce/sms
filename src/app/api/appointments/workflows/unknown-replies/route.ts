import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const prisma = getPrisma();

    const rows = await prisma.voiceAppointment.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        status: true,
        metadata: true,
        updatedAt: true,
      },
    });

    const items = rows
      .map((row) => {
        const meta = (row.metadata || {}) as AppointmentMetadata & {
          lastUnknownReply?: string;
          lastUnknownReplyAt?: string;
        };
        if (!meta.lastUnknownReply) return null;
        return {
          appointmentId: row.id,
          serviceName: row.serviceName,
          startsAt: row.startsAt.toISOString(),
          status: row.status,
          replyBody: meta.lastUnknownReply,
          repliedAt: meta.lastUnknownReplyAt || row.updatedAt.toISOString(),
        };
      })
      .filter(Boolean)
      .slice(0, limit);

    return NextResponse.json({ data: items });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { appointmentId?: string; action?: string };
    if (!body.appointmentId || body.action !== "clear") {
      return NextResponse.json({ error: "appointmentId and action=clear required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: body.appointmentId, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = { ...(row.metadata as Record<string, unknown>) };
    delete meta.lastUnknownReply;
    delete meta.lastUnknownReplyAt;

    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: { metadata: meta as object },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
