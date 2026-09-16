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
  const endsAt = String(body.endsAt || "").trim();
  const startsAt = String(body.startsAt || new Date().toISOString()).trim();
  const reason = body.reason ? String(body.reason) : undefined;

  if (!endsAt || Number.isNaN(Date.parse(endsAt))) {
    return NextResponse.json({ error: "ends_at_required" }, { status: 400 });
  }

  const row = await upsertOperationalOverride({
    workspaceId: auth.workspaceId,
    agentId,
    kind: "TEMPORARY_CLOSURE",
    effectiveFrom: new Date(startsAt),
    effectiveUntil: new Date(endsAt),
    createdByUserId: user?.id ?? null,
    payload: { active: true, startsAt, endsAt, reason },
    audit: { reason },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
