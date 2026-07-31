import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapTemplate } from "@/lib/mappers";
import { loadTemplates } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadTemplates(auth.workspaceId);
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
      category?: string;
      type?: string;
      channel?: string;
      body?: string;
      shared?: boolean;
      tags?: string[];
    };
    if (!body.name?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: "name and body required" }, { status: 400 });
    }
    const row = await getPrisma().template.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        category: body.category || "General",
        type: body.type || "Campaign",
        channel: body.channel || "SMS",
        body: body.body.trim(),
        shared: body.shared ?? true,
        tags: body.tags || [],
      },
    });
    return NextResponse.json({ data: mapTemplate(row) }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      category?: string;
      type?: string;
      channel?: string;
      body?: string;
      shared?: boolean;
      tags?: string[];
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().template.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await getPrisma().template.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim() || undefined,
        category: body.category || undefined,
        type: body.type || undefined,
        channel: body.channel || undefined,
        body: body.body?.trim() || undefined,
        shared: body.shared,
        tags: body.tags,
      },
    });
    return NextResponse.json({ data: mapTemplate(row) });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await getPrisma().template.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().template.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
