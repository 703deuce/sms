import { getPrisma } from "@/lib/db";

export type RoutingContext = {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  contactId?: string | null;
  contactTags?: string[];
  isKnownContact?: boolean;
  now?: Date;
};

export type RoutingDecision = {
  action: string;
  agentId?: string;
  destination?: string;
  ruleId?: string;
  ruleName?: string;
  reason: string;
};

export async function evaluateInboundRouting(ctx: RoutingContext): Promise<RoutingDecision> {
  const prisma = getPrisma();
  const now = ctx.now || new Date();
  const rules = await prisma.voiceRoutingRule.findMany({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    const conditions = (rule.conditions || {}) as Record<string, unknown>;
    const actions = (rule.actions || {}) as Record<string, unknown>;
    if (!matchesConditions(conditions, ctx, now)) continue;

    const action = String(actions.type || actions.action || "ai_answer");
    return {
      action,
      agentId: actions.agentId as string | undefined,
      destination: actions.destination as string | undefined,
      ruleId: rule.id,
      ruleName: rule.name,
      reason: `Matched rule: ${rule.name}`,
    };
  }

  // Default: find agent on number
  const agent = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      phoneNumberId: { not: null },
      status: "ACTIVE",
    },
  });

  return {
    action: "ai_answer",
    agentId: agent?.id,
    reason: "Default AI answer",
  };
}

function matchesConditions(
  conditions: Record<string, unknown>,
  ctx: RoutingContext,
  now: Date,
) {
  if (conditions.businessHoursOnly) {
    const hour = now.getHours();
    const start = Number(conditions.startHour ?? 9);
    const end = Number(conditions.endHour ?? 17);
    if (hour < start || hour >= end) return false;
  }
  if (conditions.knownContactOnly && !ctx.isKnownContact) return false;
  if (conditions.tag) {
    const tag = String(conditions.tag);
    if (!ctx.contactTags?.includes(tag)) return false;
  }
  if (conditions.callerPrefix) {
    const prefix = String(conditions.callerPrefix);
    if (!ctx.fromE164.startsWith(prefix)) return false;
  }
  return true;
}

/** Dry-run routing without placing a call */
export async function simulateRouting(
  workspaceId: string,
  input: { fromE164: string; toE164: string; contactId?: string },
) {
  const prisma = getPrisma();
  let contactTags: string[] = [];
  let isKnown = false;
  if (input.contactId) {
    const tags = await prisma.contactTag.findMany({
      where: { contactId: input.contactId },
    });
    contactTags = tags.map((t: { tagId: string }) => t.tagId);
    isKnown = true;
  } else {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId, phone: input.fromE164 },
    });
    if (contact) {
      isKnown = true;
      const tags = await prisma.contactTag.findMany({ where: { contactId: contact.id } });
      contactTags = tags.map((t: { tagId: string }) => t.tagId);
    }
  }

  const decision = await evaluateInboundRouting({
    workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    contactId: input.contactId,
    contactTags,
    isKnownContact: isKnown,
  });

  return { decision, contactTags, isKnownContact: isKnown };
}
