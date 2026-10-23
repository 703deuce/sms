import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

export async function isOnInternalDnc(workspaceId: string, phoneE164: string): Promise<boolean> {
  const prisma = getPrisma();
  const phone = normalizeE164(phoneE164);
  const row = await prisma.powerDialerInternalDnc.findUnique({
    where: { workspaceId_phone: { workspaceId, phone } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function listInternalDnc(workspaceId: string, q?: string) {
  const prisma = getPrisma();
  const rows = await prisma.powerDialerInternalDnc.findMany({
    where: {
      workspaceId,
      ...(q?.trim()
        ? { phone: { contains: q.replace(/\D/g, "").slice(-10) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows;
}

export async function addInternalDnc(input: {
  workspaceId: string;
  phone: string;
  reason?: string;
  source?: string;
  actorUserId?: string | null;
}) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  const row = await prisma.powerDialerInternalDnc.upsert({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
    create: {
      workspaceId: input.workspaceId,
      phone,
      reason: input.reason,
      source: input.source || "manual",
      createdByUserId: input.actorUserId || undefined,
    },
    update: { reason: input.reason, source: input.source || "manual" },
  });
  await prisma.powerDialerComplianceAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      action: "internal_dnc_add",
      actorUserId: input.actorUserId || undefined,
      detailJson: { phone, reason: input.reason },
    },
  });
  const { pdWebhookDncAdded } = await import("./webhooks/lifecycle");
  pdWebhookDncAdded({
    workspaceId: input.workspaceId,
    phone,
    source: input.source || "manual",
  });
  return row;
}

export async function removeInternalDnc(input: {
  workspaceId: string;
  phone: string;
  actorUserId?: string | null;
}) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phone);
  await prisma.powerDialerInternalDnc.deleteMany({
    where: { workspaceId: input.workspaceId, phone },
  });
  await prisma.powerDialerComplianceAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      action: "internal_dnc_remove",
      actorUserId: input.actorUserId || undefined,
      detailJson: { phone },
    },
  });
}
