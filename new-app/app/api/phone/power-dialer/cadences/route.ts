import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const rows = await prisma.powerDialerCadence.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { name?: string; stepsJson?: unknown; stopRulesJson?: unknown };
    const prisma = getPrisma();
    const row = await prisma.powerDialerCadence.create({
      data: {
        workspaceId,
        name: body.name?.trim() || "Cadence",
        stepsJson: (body.stepsJson || []) as import("@prisma/client").Prisma.InputJsonValue,
        stopRulesJson: body.stopRulesJson as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
