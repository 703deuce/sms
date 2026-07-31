import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().emailToSmsAddress.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
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
      localPart?: string;
      phoneE164?: string;
      fromNumber?: string;
      active?: boolean;
    };
    const localPart = (body.localPart || "").trim().toLowerCase().replace(/[^a-z0-9._+-]/g, "");
    if (!localPart) {
      return NextResponse.json({ error: "localPart required" }, { status: 400 });
    }
    let phoneE164: string | null = null;
    if (body.phoneE164?.trim()) {
      phoneE164 = normalizeE164(body.phoneE164);
    }
    const row = await getPrisma().emailToSmsAddress.create({
      data: {
        workspaceId: auth.workspaceId,
        localPart,
        phoneE164,
        fromNumber: body.fromNumber?.trim() || null,
        active: body.active ?? true,
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
      phoneE164?: string;
      fromNumber?: string;
      active?: boolean;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().emailToSmsAddress.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.phoneE164 !== undefined) {
      data.phoneE164 = body.phoneE164 ? normalizeE164(body.phoneE164) : null;
    }
    if (body.fromNumber !== undefined) data.fromNumber = body.fromNumber || null;
    if (body.active !== undefined) data.active = body.active;

    const row = await getPrisma().emailToSmsAddress.update({
      where: { id: body.id },
      data,
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
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().emailToSmsAddress.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().emailToSmsAddress.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
