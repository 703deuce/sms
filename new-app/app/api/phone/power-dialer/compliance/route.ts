import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { listInternalDnc } from "@/lib/server/phone/power-dialer/internal-dnc";
import { getPowerDialerSettings, updatePowerDialerSettings } from "@/lib/server/phone/power-dialer";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const [settings, dnc, audit] = await Promise.all([
      getPowerDialerSettings(workspaceId),
      listInternalDnc(workspaceId),
      prisma.powerDialerComplianceAuditLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return NextResponse.json({
      data: {
        settings,
        internalDnc: dnc,
        audit,
        externalDncConnected: Boolean(settings.externalDncScreeningConnected),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const body = (await request.json()) as Record<string, unknown>;
    const prisma = getPrisma();

    if (body.action === "acknowledge_compliance") {
      const next = await updatePowerDialerSettings(workspaceId, {
        complianceAcknowledgedAt: new Date().toISOString(),
        complianceAcknowledgedByUserId: userId,
      });
      await prisma.powerDialerComplianceAuditLog.create({
        data: {
          workspaceId,
          action: "compliance_acknowledged",
          actorUserId: userId,
        },
      });
      return NextResponse.json({ data: next });
    }

    if (body.action === "add_dnc" && typeof body.phone === "string") {
      const { addInternalDnc } = await import("@/lib/server/phone/power-dialer/internal-dnc");
      const row = await addInternalDnc({
        workspaceId,
        phone: body.phone,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        actorUserId: userId,
      });
      return NextResponse.json({ data: row });
    }

    if (body.action === "remove_dnc" && typeof body.phone === "string") {
      const { removeInternalDnc } = await import("@/lib/server/phone/power-dialer/internal-dnc");
      await removeInternalDnc({ workspaceId, phone: body.phone, actorUserId: userId });
      return NextResponse.json({ ok: true });
    }

    throw new Error("Unknown action");
  } catch (err) {
    return jsonError(err, 400);
  }
}
