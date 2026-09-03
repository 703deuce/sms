import { NextResponse } from "next/server";
import type { Prisma } from "@/lib/domain";
import { requireSession, jsonError } from "@/lib/api-auth";
import { countSegmentContacts } from "@/lib/contacts/segment-query";
import { getPrisma } from "@/lib/db";
import { loadSegments } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const segments = await loadSegments(auth.workspaceId);
    const data = await Promise.all(
      segments.map(async (segment) => ({
        ...segment,
        contactCount: await countSegmentContacts(auth.workspaceId, segment.conditions),
      })),
    );
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
      conditions?: Record<string, unknown>;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const segment = await getPrisma().segment.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        conditions: (body.conditions || {}) as Prisma.InputJsonValue,
      },
    });
    const contactCount = await countSegmentContacts(auth.workspaceId, segment.conditions);
    return NextResponse.json({ data: { ...segment, contactCount } }, { status: 201 });
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
      conditions?: Record<string, unknown>;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().segment.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch: Prisma.SegmentUpdateInput = {};
    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (trimmed) patch.name = trimmed;
    }
    if (body.conditions !== undefined) {
      patch.conditions = body.conditions as Prisma.InputJsonValue;
    }

    const segment =
      Object.keys(patch).length > 0
        ? await getPrisma().segment.update({
            where: { id: body.id },
            data: patch,
          })
        : existing;
    const contactCount = await countSegmentContacts(
      auth.workspaceId,
      segment.conditions,
    );
    return NextResponse.json({ data: { ...segment, contactCount } });
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
    const existing = await getPrisma().segment.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().segment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
