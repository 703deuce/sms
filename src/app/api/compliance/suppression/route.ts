import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadSuppressions } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadSuppressions(auth.workspaceId);
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
      phone?: string;
      email?: string;
      reason?: string;
    };
    if (!body.phone && !body.email) {
      return NextResponse.json({ error: "phone or email required" }, { status: 400 });
    }
    const phone = body.phone ? normalizeE164(body.phone) : null;
    const email = body.email?.trim().toLowerCase() || null;
    const suppressionKey = phone ? `p:${phone}` : `e:${email}`;
    const row = await getPrisma().suppression.upsert({
      where: { suppressionKey },
      create: {
        workspaceId: auth.workspaceId,
        phone,
        email,
        suppressionKey,
        reason: body.reason || "manual",
        source: "manual",
      },
      update: {
        reason: body.reason || "manual",
        source: "manual",
      },
    });
    if (phone) {
      await getPrisma().contact.updateMany({
        where: { workspaceId: auth.workspaceId, phone },
        data: { status: "UNSUBSCRIBED" },
      });
    }
    return NextResponse.json({ data: row }, { status: 201 });
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
    const existing = await getPrisma().suppression.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().suppression.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
