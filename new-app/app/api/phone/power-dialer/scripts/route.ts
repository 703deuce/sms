import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const data = await prisma.powerDialerScript.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { name?: string; body?: string; isDefault?: boolean };
    const prisma = getPrisma();
    if (body.isDefault) {
      await prisma.powerDialerScript.updateMany({
        where: { workspaceId },
        data: { isDefault: false },
      });
    }
    const row = await prisma.powerDialerScript.create({
      data: {
        workspaceId,
        name: body.name || "Script",
        body: body.body || "",
        isDefault: Boolean(body.isDefault),
      },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
