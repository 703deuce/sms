import { getPrisma } from "@/lib/db";
import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
  type MessagingRuntimeSettings,
} from "@/lib/messaging/messaging-settings";

export type RoutingContext = {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  contactId?: string | null;
  contactTags?: string[];
  isKnownContact?: boolean;
  department?: string | null;
  language?: string | null;
  intent?: string | null;
  now?: Date;
};

export type RoutingDecision = {
  action: string;
  agentId?: string;
  destination?: string;
  queueId?: string;
  ruleId?: string;
  ruleName?: string;
  reason: string;
  /** Raw actions object from the matched rule (timeout, overflow target, etc.) */
  actions?: Record<string, unknown>;
};

type BusinessHoursContext = {
  settings: MessagingRuntimeSettings;
  withinHours: boolean;
};

async function loadBusinessHoursContext(
  workspaceId: string,
  at: Date,
): Promise<BusinessHoursContext> {
  const settings = await getMessagingRuntimeSettings(workspaceId);
  return {
    settings,
    withinHours: isWithinBusinessHours(settings, at),
  };
}

/** Timezone-aware business-hours check using workspace messaging settings or rule overrides. */
export function isWithinRoutingBusinessHours(
  conditions: Record<string, unknown>,
  hoursCtx: BusinessHoursContext,
  at: Date,
): boolean {
  const tz = String(conditions.timezone || hoursCtx.settings.timezone || "America/Los_Angeles");
  const settings: MessagingRuntimeSettings = {
    ...hoursCtx.settings,
    timezone: tz,
  };

  // Rule-level hour window overrides messaging JSON when startHour/endHour provided.
  if (conditions.startHour !== undefined || conditions.endHour !== undefined) {
    const start = Number(conditions.startHour ?? 9);
    const end = Number(conditions.endHour ?? 17);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(at);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) || "mon";
    if (weekday === "sat" || weekday === "sun") return false;
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    return hour >= start && hour < end;
  }

  return isWithinBusinessHours(settings, at);
}

export async function evaluateInboundRouting(ctx: RoutingContext): Promise<RoutingDecision> {
  const prisma = getPrisma();
  const now = ctx.now || new Date();
  const hoursCtx = await loadBusinessHoursContext(ctx.workspaceId, now);

  // Resolve which agent owns the dialed DID — never let another agent's
  // flow-managed after-hours rule steal the call (that sent live PSTN to
  // Billing Specialist with empty transfer targets).
  const toE164 = ctx.toE164;
  const pn = toE164
    ? await prisma.phoneNumber.findFirst({
        where: { workspaceId: ctx.workspaceId, e164: toE164 },
        select: { id: true },
      })
    : null;
  const ownerAgent = pn
    ? await prisma.voiceAgent.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          phoneNumberId: pn.id,
          status: { in: ["ACTIVE", "TESTING"] },
        },
        select: { id: true },
      })
    : await prisma.voiceAgent.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          phoneNumberId: { not: null },
          status: "ACTIVE",
        },
        select: { id: true },
      });
  const ownerAgentId = ownerAgent?.id || null;

  const rules = await prisma.voiceRoutingRule.findMany({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { priority: "asc" },
  });

  // Prefer rules for the DID owner (or workspace-global agentId=null).
  const ordered = [
    ...rules.filter((r: { agentId: string | null }) => r.agentId === ownerAgentId),
    ...rules.filter((r: { agentId: string | null }) => r.agentId == null),
    // Other agents' rules only if nothing else matches (legacy).
    ...rules.filter(
      (r: { agentId: string | null }) =>
        r.agentId && r.agentId !== ownerAgentId,
    ),
  ];

  for (const rule of ordered) {
    const conditions = (rule.conditions || {}) as Record<string, unknown>;
    const actions = (rule.actions || {}) as Record<string, unknown>;
    if (!matchesConditions(conditions, ctx, now, hoursCtx)) continue;

    // Never route a DID-owned call to a different agent via flow-managed rules.
    const actionAgentId =
      (actions.agentId as string | undefined) || rule.agentId || undefined;
    if (
      ownerAgentId &&
      actionAgentId &&
      actionAgentId !== ownerAgentId &&
      (conditions as { flowManaged?: boolean }).flowManaged
    ) {
      continue;
    }

    const action = String(actions.type || actions.action || "ai_answer");
    return {
      action,
      agentId: actionAgentId || ownerAgentId || undefined,
      destination: actions.destination as string | undefined,
      queueId: actions.queueId as string | undefined,
      ruleId: rule.id,
      ruleName: rule.name,
      reason: `Matched rule: ${rule.name}`,
      actions,
    };
  }

  return {
    action: "ai_answer",
    agentId: ownerAgentId || undefined,
    reason: "Default AI answer",
  };
}

function matchesConditions(
  conditions: Record<string, unknown>,
  ctx: RoutingContext,
  now: Date,
  hoursCtx: BusinessHoursContext,
) {
  const withinHours = isWithinRoutingBusinessHours(conditions, hoursCtx, now);

  if (conditions.businessHoursOnly && !withinHours) return false;
  if (conditions.afterHoursOnly && withinHours) return false;

  if (conditions.knownContactOnly && !ctx.isKnownContact) return false;

  const requiredTags = normalizeTagList(conditions);
  if (requiredTags.length) {
    const have = ctx.contactTags || [];
    if (!requiredTags.every((t) => have.includes(t))) return false;
  }

  const prefix = String(conditions.prefix || conditions.callerPrefix || "");
  if (prefix && !ctx.fromE164.startsWith(prefix)) return false;

  if (conditions.department) {
    const want = String(conditions.department).toLowerCase();
    const have = (ctx.department || "").toLowerCase();
    if (!have || have !== want) return false;
  }

  if (conditions.language) {
    const want = String(conditions.language).toLowerCase();
    const have = (ctx.language || "").toLowerCase();
    if (!have || have !== want) return false;
  }

  if (conditions.intent) {
    const want = String(conditions.intent).toLowerCase();
    const have = (ctx.intent || "").toLowerCase();
    if (!have || have !== want) return false;
  }

  return true;
}

function normalizeTagList(conditions: Record<string, unknown>): string[] {
  if (Array.isArray(conditions.tags)) {
    return conditions.tags.map(String);
  }
  if (conditions.tag) return [String(conditions.tag)];
  return [];
}

/** Dry-run routing without placing a call */
export async function simulateRouting(
  workspaceId: string,
  input: { fromE164: string; toE164: string; contactId?: string },
) {
  const prisma = getPrisma();
  let contactTags: string[] = [];
  let isKnown = false;
  let department: string | null = null;
  let language: string | null = null;

  if (input.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, workspaceId },
    });
    if (contact) {
      isKnown = true;
      const tags = await prisma.contactTag.findMany({ where: { contactId: contact.id } });
      contactTags = tags.map((t: { tagId: string }) => t.tagId);
      const cf = (contact.customFields || {}) as Record<string, unknown>;
      department = cf.department ? String(cf.department) : null;
      language = cf.language ? String(cf.language) : null;
    }
  } else {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId, phone: input.fromE164 },
    });
    if (contact) {
      isKnown = true;
      const tags = await prisma.contactTag.findMany({ where: { contactId: contact.id } });
      contactTags = tags.map((t: { tagId: string }) => t.tagId);
      const cf = (contact.customFields || {}) as Record<string, unknown>;
      department = cf.department ? String(cf.department) : null;
      language = cf.language ? String(cf.language) : null;
    }
  }

  const decision = await evaluateInboundRouting({
    workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    contactId: input.contactId,
    contactTags,
    isKnownContact: isKnown,
    department,
    language,
  });

  return { decision, contactTags, isKnownContact: isKnown };
}
