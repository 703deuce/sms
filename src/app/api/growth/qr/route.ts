import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPrisma().qrCode.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data });
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
      targetType?: string;
      targetUrl?: string;
    };
    const name = (body.name || "").trim();
    const targetUrl = (body.targetUrl || "").trim();
    if (!name || !targetUrl) {
      return NextResponse.json({ error: "name and targetUrl are required" }, { status: 400 });
    }
    const created = await getPrisma().qrCode.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        targetType: body.targetType || "url",
        targetUrl,
        status: "Active",
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
