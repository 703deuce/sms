import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  enrollContactInCadence,
  pauseCadenceEnrollment,
  resumeCadenceEnrollment,
} from "@/lib/server/phone/power-dialer/cadence-engine";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const prisma = getPrisma();
    if (body.action === "enroll" && typeof body.contactId === "string") {
      const row = await enrollContactInCadence(workspaceId, id, body.contactId);
      return NextResponse.json({ data: row });
    }
    if (body.action === "pause" && typeof body.enrollmentId === "string") {
      await pauseCadenceEnrollment(workspaceId, body.enrollmentId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "resume" && typeof body.enrollmentId === "string") {
      await resumeCadenceEnrollment(workspaceId, body.enrollmentId);
      return NextResponse.json({ ok: true });
    }
    const data = await prisma.powerDialerCadence.updateMany({
      where: { id, workspaceId },
      data: {
        name: typeof body.name === "string" ? body.name : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        stepsJson: body.stepsJson as import("@prisma/client").Prisma.InputJsonValue,
        stopRulesJson: body.stopRulesJson as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
