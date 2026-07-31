import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPrisma().senderPool.findMany({
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
      phoneNumberIds?: string[];
      description?: string;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const row = await getPrisma().senderPool.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        description: body.description || null,
        phoneNumberIds: body.phoneNumberIds || [],
        status: "Active",
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
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
      phoneNumberIds?: string[];
      status?: string;
      description?: string;
    };
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await getPrisma().senderPool.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await getPrisma().senderPool.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim() || undefined,
        description: body.description === undefined ? undefined : body.description,
        phoneNumberIds: body.phoneNumberIds,
        status: body.status || undefined,
      },
    });
    return NextResponse.json({ data: row });
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
    const existing = await getPrisma().senderPool.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().senderPool.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
