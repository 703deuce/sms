import "server-only";

import { getPrisma } from "@/lib/db";

export type SlotPricingInput = {
  basePriceCents: number;
  startsAt: string | Date;
  appointmentTypeId?: string;
  staffId?: string;
  locationId?: string;
};

export type PricingAdjustment = {
  ruleId: string;
  ruleName: string;
  adjustmentType: string;
  adjustmentValue: number;
  deltaCents: number;
};

export async function listDynamicPricingRules(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.dynamicPricingRule.findMany({
    where: { workspaceId },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
}

export async function upsertDynamicPricingRule(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    ruleType: string;
    conditions?: Record<string, unknown>;
    adjustmentType: "percent" | "fixed";
    adjustmentValue: number;
    priority?: number;
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const data = {
    name: input.name.trim(),
    ruleType: input.ruleType,
    conditions: input.conditions ?? {},
    adjustmentType: input.adjustmentType,
    adjustmentValue: input.adjustmentValue,
    priority: input.priority ?? 0,
    active: input.active ?? true,
    metadata: input.metadata,
  };

  if (input.id) {
    return prisma.dynamicPricingRule.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.dynamicPricingRule.create({ data: { workspaceId, ...data } });
}

function ruleMatches(
  rule: {
    ruleType: string;
    conditions: unknown;
  },
  slot: SlotPricingInput,
  startsAt: Date,
) {
  const conditions = (rule.conditions || {}) as Record<string, unknown>;

  switch (rule.ruleType) {
    case "day_of_week": {
      const days = conditions.days as number[] | undefined;
      if (!days?.length) return false;
      return days.includes(startsAt.getUTCDay());
    }
    case "time_of_day": {
      const startHour = conditions.startHour as number | undefined;
      const endHour = conditions.endHour as number | undefined;
      if (startHour == null || endHour == null) return false;
      const hour = startsAt.getUTCHours();
      return hour >= startHour && hour < endHour;
    }
    case "appointment_type": {
      const typeIds = conditions.appointmentTypeIds as string[] | undefined;
      if (!typeIds?.length || !slot.appointmentTypeId) return false;
      return typeIds.includes(slot.appointmentTypeId);
    }
    case "early_bird": {
      const minDaysAhead = (conditions.minDaysAhead as number) ?? 7;
      const daysAhead = (startsAt.getTime() - Date.now()) / 86_400_000;
      return daysAhead >= minDaysAhead;
    }
    case "last_minute": {
      const maxHoursAhead = (conditions.maxHoursAhead as number) ?? 24;
      const hoursAhead = (startsAt.getTime() - Date.now()) / 3_600_000;
      return hoursAhead >= 0 && hoursAhead <= maxHoursAhead;
    }
    default:
      return false;
  }
}

function applyAdjustment(
  basePriceCents: number,
  adjustmentType: string,
  adjustmentValue: number,
): number {
  if (adjustmentType === "percent") {
    return Math.round(basePriceCents * (adjustmentValue / 100));
  }
  return adjustmentValue;
}

export async function evaluateSlotPrice(workspaceId: string, slot: SlotPricingInput) {
  const prisma = getPrisma();
  const rules = await prisma.dynamicPricingRule.findMany({
    where: { workspaceId, active: true },
    orderBy: { priority: "desc" },
  });

  const startsAt = slot.startsAt instanceof Date ? slot.startsAt : new Date(slot.startsAt);
  let priceCents = slot.basePriceCents;
  const adjustments: PricingAdjustment[] = [];

  for (const rule of rules) {
    if (!ruleMatches(rule, slot, startsAt)) continue;
    const delta = applyAdjustment(slot.basePriceCents, rule.adjustmentType, rule.adjustmentValue);
    priceCents += delta;
    adjustments.push({
      ruleId: rule.id,
      ruleName: rule.name,
      adjustmentType: rule.adjustmentType,
      adjustmentValue: rule.adjustmentValue,
      deltaCents: delta,
    });
  }

  return {
    basePriceCents: slot.basePriceCents,
    finalPriceCents: Math.max(0, priceCents),
    adjustments,
  };
}
