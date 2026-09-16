import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { upsertOperationalOverride } from "@/lib/voice-v2/operating-maturity/operational-store";

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth || !auth.workspaceId) {
    return ("error" in auth && auth.error) || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = auth.session.user;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const agentId = String(body.agentId || "").trim() || null;
  const label = String(body.label || "On-call").trim();
  const effectiveUntil = String(body.effectiveUntil || "").trim();
  const phoneE164 = body.phoneE164 ? String(body.phoneE164) : undefined;
  const transferPlanId = body.transferPlanId ? String(body.transferPlanId) : null;

  if (!effectiveUntil || Number.isNaN(Date.parse(effectiveUntil))) {
    return NextResponse.json({ error: "effective_until_required" }, { status: 400 });
  }

  const row = await upsertOperationalOverride({
    workspaceId: auth.workspaceId,
    agentId,
    kind: "ON_CALL",
    effectiveUntil: new Date(effectiveUntil),
    createdByUserId: user?.id ?? null,
    payload: {
      label,
      effectiveUntil,
      destination: { label, phoneE164, transferPlanId },
    },
    audit: {
      previous: body.previousTarget ?? null,
      newTarget: label,
    },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
