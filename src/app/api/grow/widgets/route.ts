import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { randomBytes } from "crypto";

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().growWidget.findMany({
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
      widgetType?: string;
      config?: Record<string, unknown>;
      linkedFormId?: string;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const row = await getPrisma().growWidget.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        slug: slugify(body.name),
        widgetType: body.widgetType || "popup",
        config: body.config || {},
        linkedFormId: body.linkedFormId,
        status: "draft",
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
