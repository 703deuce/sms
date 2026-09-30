import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    traceMctbDebug("exclusions", "get_start", { workspaceId: auth.workspaceId });
    const prisma = getPrisma();
    const rows = await prisma.suppression.findMany({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ source: "mctb_exclusion" }, { source: "personal_blocked" }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    traceMctbDebug("exclusions", "get_complete", {
      workspaceId: auth.workspaceId,
      count: rows.length,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    traceMctbDebugError("exclusions", "get_failed", err);
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const phoneRaw = body.phone ?? body.phoneE164 ?? "";
    const phone = normalizeE164(String(phoneRaw));
    if (!phone) {
      return jsonError(new Error("Valid phone number is required"), 400);
    }
    const reason = String(body.reason ?? body.label ?? "Do not text").trim();
    traceMctbDebug("exclusions", "post_start", {
      workspaceId: auth.workspaceId,
      phone,
      reason,
    });
    const key = `${auth.workspaceId}:mctb:${phone}`;
    const prisma = getPrisma();
    const row = await prisma.suppression.upsert({
      where: { suppressionKey: key },
      create: {
        workspaceId: auth.workspaceId,
        phone,
        suppressionKey: key,
        source: "mctb_exclusion",
        reason,
      },
      update: { reason },
    });
    traceMctbDebug("exclusions", "post_complete", {
      workspaceId: auth.workspaceId,
      exclusionId: row.id,
      phone,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    traceMctbDebugError("exclusions", "post_failed", err);
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(new Error("id required"), 400);
    traceMctbDebug("exclusions", "delete_start", {
      workspaceId: auth.workspaceId,
      exclusionId: id,
    });
    const prisma = getPrisma();
    await prisma.suppression.deleteMany({
      where: { id, workspaceId: auth.workspaceId, source: "mctb_exclusion" },
    });
    traceMctbDebug("exclusions", "delete_complete", {
      workspaceId: auth.workspaceId,
      exclusionId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    traceMctbDebugError("exclusions", "delete_failed", err);
    return jsonError(err);
  }
}
