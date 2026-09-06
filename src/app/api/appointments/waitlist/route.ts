import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { processWaitlistNotification } from "@/lib/appointments/waitlist";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const entries = await prisma.appointmentWaitlistEntry.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: entries });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      entryId?: string;
      action?: "notify" | "remove" | "reactivate";
      serviceName?: string;
      startsAt?: string;
    };
    if (!body.entryId || !body.action) {
      return NextResponse.json({ error: "entryId and action required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const entry = await prisma.appointmentWaitlistEntry.findFirst({
      where: { id: body.entryId, workspaceId: auth.workspaceId },
    });
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "notify") {
      const serviceName = body.serviceName || entry.serviceName || "Appointment";
      const startsAt = body.startsAt || new Date(Date.now() + 86400000).toISOString();
      await processWaitlistNotification({
        waitlistEntryId: entry.id,
        serviceName,
        startsAt,
      });
      const updated = await prisma.appointmentWaitlistEntry.findUnique({ where: { id: entry.id } });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "remove") {
      const updated = await prisma.appointmentWaitlistEntry.update({
        where: { id: entry.id },
        data: { status: "removed", updatedAt: new Date() },
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "reactivate") {
      const updated = await prisma.appointmentWaitlistEntry.update({
        where: { id: entry.id },
        data: { status: "active", updatedAt: new Date() },
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
