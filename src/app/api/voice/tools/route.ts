import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().voiceTool.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { name: "asc" },
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
      description?: string;
      toolType?: string;
      config?: Record<string, unknown>;
    };
    const name = (body.name || "").trim();
    if (!name || !body.toolType) {
      return NextResponse.json({ error: "name and toolType required" }, { status: 400 });
    }
    const row = await getPrisma().voiceTool.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        description: body.description,
        toolType: body.toolType,
        config: body.config || {},
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
