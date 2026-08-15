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
    const targetUserId = (body.userId as string) || auth.session.userId;
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { type: true },
    });
    const personalWorkspace = workspace?.type === "PERSONAL";
    // Personal workspace owners manage their own number forwarding without phone admin.
    if (
      !personalWorkspace &&
      (targetUserId !== auth.session.userId || body.phoneNumberId)
    ) {
      const { requireWorkspacePhoneAdmin } = await import("@/lib/phone/softphone-permissions");
      await requireWorkspacePhoneAdmin(auth.workspaceId, auth.session.userId);
    }
    const row = await upsertForwardingRule({
      workspaceId: auth.workspaceId,
      id: body.id as string | undefined,
      userId: targetUserId,
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
    const prisma = getPrisma();
    const existing = await prisma.callForwardingRule.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.userId !== auth.session.userId || existing.phoneNumberId) {
      const { requireWorkspacePhoneAdmin } = await import("@/lib/phone/softphone-permissions");
      await requireWorkspacePhoneAdmin(auth.workspaceId, auth.session.userId);
    }
    await prisma.callForwardingRule.deleteMany({
      where: { id, workspaceId: auth.workspaceId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
