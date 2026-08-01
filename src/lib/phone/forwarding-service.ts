import { getPrisma } from "@/lib/db";

export async function listForwardingRules(workspaceId: string, userId?: string) {
  return getPrisma().callForwardingRule.findMany({
    where: {
      workspaceId,
      ...(userId ? { userId } : {}),
    },
    orderBy: { priority: "asc" },
  });
}

export async function upsertForwardingRule(input: {
  workspaceId: string;
  id?: string;
  userId?: string | null;
  phoneNumberId?: string | null;
  mode: string;
  targetType: string;
  targetValue: string;
  ringSeconds?: number;
  priority?: number;
  active?: boolean;
  configJson?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  if (input.id) {
    return prisma.callForwardingRule.update({
      where: { id: input.id },
      data: {
        mode: input.mode,
        targetType: input.targetType,
        targetValue: input.targetValue,
        ringSeconds: input.ringSeconds ?? 25,
        priority: input.priority ?? 100,
        active: input.active ?? true,
        configJson: input.configJson as object | undefined,
        userId: input.userId ?? undefined,
        phoneNumberId: input.phoneNumberId ?? undefined,
      },
    });
  }
  return prisma.callForwardingRule.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId || null,
      phoneNumberId: input.phoneNumberId || null,
      mode: input.mode,
      targetType: input.targetType,
      targetValue: input.targetValue,
      ringSeconds: input.ringSeconds ?? 25,
      priority: input.priority ?? 100,
      active: input.active ?? true,
      configJson: input.configJson as object | undefined,
    },
  });
}

/** Resolve the first matching active forwarding rule for an inbound call. */
export async function resolveForwarding(input: {
  workspaceId: string;
  phoneNumberId?: string | null;
  userId?: string | null;
  busy?: boolean;
  unanswered?: boolean;
  offline?: boolean;
  afterHours?: boolean;
}) {
  const rules = await getPrisma().callForwardingRule.findMany({
    where: {
      workspaceId: input.workspaceId,
      active: true,
      OR: [
        ...(input.phoneNumberId ? [{ phoneNumberId: input.phoneNumberId }] : []),
        ...(input.userId ? [{ userId: input.userId }] : []),
        { phoneNumberId: null, userId: null },
      ],
    },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    if (rule.mode === "always") return rule;
    if (rule.mode === "busy" && input.busy) return rule;
    if (rule.mode === "unanswered" && input.unanswered) return rule;
    if (rule.mode === "offline" && input.offline) return rule;
    if (rule.mode === "after_hours" && input.afterHours) return rule;
    if (rule.mode === "simultaneous" || rule.mode === "sequential") return rule;
  }
  return null;
}
