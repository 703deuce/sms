import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().voiceCampaign.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      agentId?: string;
      audienceConfig?: Record<string, unknown>;
      scheduleConfig?: Record<string, unknown>;
    };
    if (!body.name?.trim() || !body.agentId) {
      return NextResponse.json({ error: "name and agentId required" }, { status: 400 });
    }
    const row = await getPrisma().voiceCampaign.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        agentId: body.agentId,
        audienceConfig: body.audienceConfig || {},
        scheduleConfig: body.scheduleConfig || {},
        status: "DRAFT",
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
