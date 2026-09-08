import "server-only";

import { getPrisma } from "@/lib/db";

export type WaitlistEntryContext = {
  entryId: string;
  contactId?: string | null;
  appointmentTypeId?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
};

export async function listWaitlistPriorityRules(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.waitlistPriorityRule.findMany({
    where: { workspaceId },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
}

export async function upsertWaitlistPriorityRule(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    ruleType: string;
    scoreDelta?: number;
    conditions?: Record<string, unknown>;
    priority?: number;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    ruleType: input.ruleType,
    scoreDelta: input.scoreDelta ?? 0,
    conditions: input.conditions ?? {},
    priority: input.priority ?? 0,
    active: input.active ?? true,
    metadata: input.metadata,
  };

  if (input.id) {
    return prisma.waitlistPriorityRule.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.waitlistPriorityRule.create({ data: { workspaceId, ...data } });
}

async function entryMatchesRule(
  workspaceId: string,
  entry: WaitlistEntryContext,
  rule: { ruleType: string; conditions: unknown },
): Promise<boolean> {
  const conditions = (rule.conditions || {}) as Record<string, unknown>;

  switch (rule.ruleType) {
    case "first_come": {
      const maxAgeHours = (conditions.maxAgeHours as number) ?? 72;
      const ageHours = (Date.now() - entry.createdAt.getTime()) / 3_600_000;
      return ageHours <= maxAgeHours;
    }
    case "appointment_type": {
      const typeIds = conditions.appointmentTypeIds as string[] | undefined;
      if (!typeIds?.length || !entry.appointmentTypeId) return false;
      return typeIds.includes(entry.appointmentTypeId);
    }
    case "membership": {
      if (!entry.contactId) return false;
      const prisma = getPrisma();
      const sub = await prisma.serviceMembershipSubscription.findFirst({
        where: { workspaceId, contactId: entry.contactId, status: "active" },
      });
      return Boolean(sub);
    }
    case "loyalty": {
      if (!entry.contactId) return false;
      const minPoints = (conditions.minPoints as number) ?? 100;
      const prisma = getPrisma();
      const program = await prisma.loyaltyProgram.findFirst({
        where: { workspaceId, active: true },
      });
      if (!program) return false;
      const latest = await prisma.loyaltyLedgerEntry.findFirst({
        where: { programId: program.id, contactId: entry.contactId },
        orderBy: { createdAt: "desc" },
      });
      return (latest?.pointsBalance ?? 0) >= minPoints;
    }
    case "vip_tag": {
      if (!entry.contactId) return false;
      const tagName = conditions.tagName as string | undefined;
      if (!tagName) return false;
      const prisma = getPrisma();
      const tagged = await prisma.contactTag.findFirst({
        where: {
          contactId: entry.contactId,
          tag: { workspaceId, name: tagName },
        },
      });
      return Boolean(tagged);
    }
    case "custom": {
      const metaKey = conditions.metadataKey as string | undefined;
      const metaValue = conditions.metadataValue;
      if (!metaKey) return false;
      const meta = (entry.metadata || {}) as Record<string, unknown>;
      return meta[metaKey] === metaValue;
    }
    default:
      return false;
  }
}

export async function scoreWaitlistEntry(workspaceId: string, entry: WaitlistEntryContext) {
  const prisma = getPrisma();
  const rules = await prisma.waitlistPriorityRule.findMany({
    where: { workspaceId, active: true },
    orderBy: { priority: "desc" },
  });

  let score = 0;
  const appliedRules: Array<{ ruleId: string; ruleName: string; scoreDelta: number }> = [];

  for (const rule of rules) {
    if (await entryMatchesRule(workspaceId, entry, rule)) {
      score += rule.scoreDelta;
      appliedRules.push({ ruleId: rule.id, ruleName: rule.name, scoreDelta: rule.scoreDelta });
    }
  }

  const ageHours = (Date.now() - entry.createdAt.getTime()) / 3_600_000;
  score += Math.max(0, 100 - ageHours);

  return { entryId: entry.entryId, score, appliedRules };
}

export async function rankWaitlistEntries(workspaceId: string, entryIds?: string[]) {
  const prisma = getPrisma();
  const entries = await prisma.appointmentWaitlistEntry.findMany({
    where: {
      workspaceId,
      status: "active",
      ...(entryIds?.length ? { id: { in: entryIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  const scored = await Promise.all(
    entries.map(async (e: {
      id: string;
      contactId: string | null;
      appointmentTypeId: string | null;
      createdAt: Date;
      metadata: unknown;
    }) =>
      scoreWaitlistEntry(workspaceId, {
        entryId: e.id,
        contactId: e.contactId,
        appointmentTypeId: e.appointmentTypeId,
        createdAt: e.createdAt,
        metadata: e.metadata as Record<string, unknown> | null,
      }),
    ),
  );

  return scored.sort((a, b) => b.score - a.score);
}
