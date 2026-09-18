import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV2OnCallOperationalOverride, VoiceV2TemporaryClosure } from "./types";

export async function loadLiveTemporaryClosure(input: {
  workspaceId: string;
  agentId?: string | null;
}): Promise<VoiceV2TemporaryClosure | null> {
  const prisma = getPrisma();
  if (!prisma.voiceOperationalOverride?.findFirst) return null;
  const row = await prisma.voiceOperationalOverride.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: "TEMPORARY_CLOSURE",
      ...(input.agentId ? { agentId: input.agentId } : {}),
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!row?.payload) return null;
  const p = row.payload as Record<string, unknown>;
  return {
    active: true,
    startsAt: String(p.startsAt || row.effectiveFrom.toISOString()),
    endsAt: String(p.endsAt || row.effectiveUntil?.toISOString() || ""),
    reason: p.reason ? String(p.reason) : undefined,
  };
}

export async function loadLiveOnCallOverride(input: {
  workspaceId: string;
  agentId?: string | null;
}): Promise<VoiceV2OnCallOperationalOverride | null> {
  const prisma = getPrisma();
  if (!prisma.voiceOperationalOverride?.findFirst) return null;
  const row = await prisma.voiceOperationalOverride.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: "ON_CALL",
      ...(input.agentId ? { agentId: input.agentId } : {}),
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!row?.payload) return null;
  const p = row.payload as Record<string, unknown>;
  const dest = (p.destination || {}) as Record<string, unknown>;
  return {
    label: String(p.label || "On-call override"),
    effectiveUntil: String(p.effectiveUntil || row.effectiveUntil?.toISOString() || ""),
    reason: p.reason ? String(p.reason) : undefined,
    destination: {
      label: String(dest.label || p.label || "On-call"),
      phoneE164: dest.phoneE164 ? String(dest.phoneE164) : undefined,
      contactId: dest.contactId ? String(dest.contactId) : undefined,
      transferPlanId: dest.transferPlanId ? String(dest.transferPlanId) : null,
    },
  };
}

export async function upsertOperationalOverride(input: {
  workspaceId: string;
  agentId?: string | null;
  kind: "TEMPORARY_CLOSURE" | "ON_CALL";
  payload: Record<string, unknown>;
  effectiveFrom?: Date;
  effectiveUntil?: Date | null;
  createdByUserId?: string | null;
  audit?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  return prisma.voiceOperationalOverride.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId ?? null,
      kind: input.kind,
      payload: input.payload,
      effectiveFrom: input.effectiveFrom || new Date(),
      effectiveUntil: input.effectiveUntil ?? null,
      createdByUserId: input.createdByUserId ?? null,
      auditJson: input.audit ?? undefined,
    },
  });
}
