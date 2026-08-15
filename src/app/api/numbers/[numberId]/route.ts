import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { validateForwardingDestination } from "@/lib/numbers/forwarding-validation";

const assignmentsInclude = {
  assignments: { include: { user: { select: { id: true, name: true } } } },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const row = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
      include: assignmentsInclude,
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: mapPhoneNumber(row) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json()) as {
      friendlyName?: string;
      status?: string;
      voiceForwardTo?: string | null;
      webhookUrl?: string | null;
      settingsJson?: Record<string, unknown> | null;
      assignedUserIds?: string[];
    };
    const prisma = getPrisma();
    const existing = await prisma.phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {
      friendlyName: body.friendlyName ?? undefined,
      status: body.status ?? undefined,
    };
    if (body.voiceForwardTo !== undefined) {
      const nextForward = body.voiceForwardTo?.trim() || null;
      if (nextForward) {
        const validated = validateForwardingDestination({
          destination: nextForward,
          numberE164: existing.e164,
        });
        if (!validated.ok) {
          return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        data.voiceForwardTo = validated.e164;
      } else {
        data.voiceForwardTo = null;
      }

      const settings =
        existing.settingsJson && typeof existing.settingsJson === "object"
          ? { ...(existing.settingsJson as Record<string, unknown>) }
          : {};
      const parked = settings.parked === true || settings.personalParked === true;
      if (!parked) {
        settings.personalServiceState = nextForward ? "FORWARDING" : settings.voicemailEnabled ? "VOICEMAIL" : "ACTIVE";
      }
      data.settingsJson = settings;
    }
    if (body.webhookUrl !== undefined) {
      data.webhookUrl = body.webhookUrl?.trim() || null;
    }
    if (body.settingsJson !== undefined) {
      data.settingsJson = body.settingsJson ?? null;
    }

    await prisma.phoneNumber.update({ where: { id: numberId }, data });

    // Reconcile per-number user assignments when provided.
    if (Array.isArray(body.assignedUserIds)) {
      const validMembers = await prisma.membership.findMany({
        where: { workspaceId: auth.workspaceId, userId: { in: body.assignedUserIds } },
        select: { userId: true },
      });
      const validIds = new Set(
        (validMembers as Array<{ userId: string }>).map((m) => m.userId),
      );
      const desired = [...new Set(body.assignedUserIds.filter((id) => validIds.has(id)))];

      await prisma.phoneNumberAssignment.deleteMany({ where: { phoneNumberId: numberId } });
      for (const userId of desired) {
        await prisma.phoneNumberAssignment.create({
          data: { phoneNumberId: numberId, userId },
        });
      }
    }

    const updated = await prisma.phoneNumber.findFirst({
      where: { id: numberId },
      include: assignmentsInclude,
    });
    return NextResponse.json({ data: mapPhoneNumber(updated!) });
  } catch (err) {
    return jsonError(err, 400);
  }
}
