import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapLegacyCallbackStatus } from "@/lib/voice-v2/operating-maturity/callback-sla";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth || !auth.workspaceId) {
    return ("error" in auth && auth.error) || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const rows = await prisma.callbackRequest.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      callerE164: true,
      requestedAt: true,
      metadata: true,
    },
  });

  const data = rows.map((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const sla = meta.voiceV2CallbackSla as Record<string, unknown> | undefined;
    const lifecycle = sla?.lifecycle
      ? String(sla.lifecycle)
      : mapLegacyCallbackStatus(row.status);
    return {
      id: row.id,
      callerPhone: row.callerE164,
      createdAt: row.requestedAt.toISOString(),
      lifecycle,
      promisedDeadline: sla?.promisedDeadline ? String(sla.promisedDeadline) : null,
      sourceVoiceCallId: sla?.sourceVoiceCallId ? String(sla.sourceVoiceCallId) : null,
    };
  });

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: Request) {
  const auth = await requireSession();
  if ("error" in auth || !auth.workspaceId) {
    return ("error" in auth && auth.error) || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    callbackId?: string;
    lifecycle?: string;
  };
  const callbackId = String(body.callbackId || "").trim();
  const lifecycle = String(body.lifecycle || "COMPLETED").trim();
  if (!callbackId) {
    return NextResponse.json({ error: "callback_id_required" }, { status: 400 });
  }

  const prisma = getPrisma();
  const row = await prisma.callbackRequest.findFirst({
    where: { id: callbackId, workspaceId: auth.workspaceId },
  });
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = (row.metadata || {}) as Record<string, unknown>;
  const sla = (meta.voiceV2CallbackSla as Record<string, unknown>) || {};
  const nextMeta = {
    ...meta,
    voiceV2CallbackSla: {
      ...sla,
      lifecycle,
      completedAt: lifecycle === "COMPLETED" ? new Date().toISOString() : sla.completedAt,
    },
  };

  const status =
    lifecycle === "COMPLETED"
      ? "completed"
      : lifecycle === "CANCELED"
        ? "dismissed"
        : row.status;

  await prisma.callbackRequest.update({
    where: { id: row.id },
    data: {
      status,
      metadata: nextMeta as object,
    },
  });

  return NextResponse.json({ ok: true, id: row.id, lifecycle });
}
