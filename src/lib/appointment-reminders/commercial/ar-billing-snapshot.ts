import "server-only";

import {
  AR_PLAN_CATALOG,
  arPlanDefinition,
  type ArPlanKey,
} from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import { resolveArWorkspaceCommercial } from "@/lib/appointment-reminders/commercial/ar-workspace-plan";
import { getArSmsUsageSnapshot } from "@/lib/appointment-reminders/ar-sms-usage";
import { getArEmailUsageSnapshot } from "@/lib/appointment-reminders/commercial/ar-email-usage";
import { getArAiConversationUsageSnapshot } from "@/lib/appointment-reminders/commercial/ar-ai-conversation-usage";
import { countWorkspaceImportedCalendars } from "@/lib/appointment-reminders/commercial/ar-calendar-limits";

export type ArUsageMeterSnapshot = {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  state: "normal" | "approaching" | "exhausted";
};

function meterState(used: number, limit: number): ArUsageMeterSnapshot["state"] {
  if (limit <= 0) return "normal";
  if (used >= limit) return "exhausted";
  if (used / limit >= 0.8) return "approaching";
  return "normal";
}

function toMeter(used: number, limit: number): ArUsageMeterSnapshot {
  const remaining = limit > 0 ? Math.max(0, limit - used) : 0;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return {
    used,
    limit,
    remaining,
    percent,
    state: meterState(used, limit),
  };
}

export async function loadArBillingSnapshot(workspaceId: string) {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanDefinition(commercial.planKey);
  const [sms, email, ai, importedCalendars] = await Promise.all([
    getArSmsUsageSnapshot(workspaceId),
    getArEmailUsageSnapshot(workspaceId),
    getArAiConversationUsageSnapshot(workspaceId),
    countWorkspaceImportedCalendars(workspaceId),
  ]);

  return {
    hasProductAccess: commercial.hasProductAccess,
    plan: {
      key: commercial.planKey,
      displayName: plan.displayName,
      monthlyPriceCents: plan.monthlyPriceCents,
      features: plan,
    },
    subscription: {
      status: commercial.stripeStatus,
      stripeSubscriptionId: commercial.stripeSubscriptionId,
      cancelAtPeriodEnd: commercial.cancelAtPeriodEnd,
      paidThrough: commercial.paidThrough?.toISOString() ?? null,
      isLegacyGrandfather: commercial.isLegacyGrandfather,
    },
    usagePeriod: {
      periodKey: commercial.usagePeriod.periodKey,
      periodStart: commercial.usagePeriod.periodStart.toISOString(),
      periodEnd: commercial.usagePeriod.periodEnd.toISOString(),
      source: commercial.usagePeriod.source,
    },
    usage: {
      smsSegments: toMeter(sms.usedInPeriod, sms.limit),
      emails: toMeter(email.usedInPeriod, email.limit),
      aiConversations: toMeter(ai.usedInPeriod, ai.limit),
      importedCalendars: {
        used: importedCalendars,
        limit: plan.importedCalendarsMax,
      },
    },
    catalog: AR_PLAN_CATALOG,
  };
}

export type { ArPlanKey };
