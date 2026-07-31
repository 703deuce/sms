import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadApiKeys } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await loadApiKeys(auth.workspaceId);
    return NextResponse.json({
      data: rows.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const raw = `tv_${randomBytes(24).toString("hex")}`;
    const prefix = raw.slice(0, 10);
    const hashedKey = createHash("sha256").update(raw).digest("hex");
    const row = await getPrisma().apiKey.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        prefix,
        hashedKey,
      },
    });
    return NextResponse.json(
      {
        data: {
          id: row.id,
          name: row.name,
          prefix: row.prefix,
          key: raw,
          createdAt: row.createdAt,
        },
      },
      { status: 201 },
    );
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
    const existing = await getPrisma().apiKey.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().apiKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
