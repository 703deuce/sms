import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listForwardingRules, upsertForwardingRule } from "@/lib/phone/forwarding-service";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "1";
    const rows = await listForwardingRules(
      auth.workspaceId,
      mine ? auth.session.userId : undefined,
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await upsertForwardingRule({
      workspaceId: auth.workspaceId,
      id: body.id as string | undefined,
      userId: (body.userId as string) || auth.session.userId,
      phoneNumberId: (body.phoneNumberId as string) || null,
      mode: String(body.mode || "always"),
      targetType: String(body.targetType || "external"),
      targetValue: String(body.targetValue || ""),
      ringSeconds: Number(body.ringSeconds || 25),
      priority: Number(body.priority || 100),
      active: body.active !== false,
      configJson: (body.configJson as Record<string, unknown>) || undefined,
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await getPrisma().callForwardingRule.deleteMany({
      where: { id, workspaceId: auth.workspaceId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
