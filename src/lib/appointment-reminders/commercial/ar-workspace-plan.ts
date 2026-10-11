import "server-only";

import { getPrisma } from "@/lib/db";
import {
  arPlanDefinition,
  type ArPlanKey,
  isArPlanKey,
} from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  legacyGrandfatherPeriod,
  rollingFreeMonthPeriod,
  stripeSubscriptionPeriod,
  type ArWorkspaceCommercialSnapshot,
} from "@/lib/appointment-reminders/commercial/ar-usage-period";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";
import { APPOINTMENTS_SOLUTION_TYPE } from "@/lib/appointments/settings";

const LIMITS_PLAN_KEY = "arCommercialPlanKey";
const LIMITS_FREE_STARTED = "arFreeEntitlementStartedAt";

const ACTIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Explicit workspace IDs only — no BUSINESS/MCTB heuristics (launch has no grandfather cohort by default). */
function arLegacyGrandfatherWorkspaceIds(): Set<string> {
  const raw = process.env.TRANSOVO_AR_LEGACY_WORKSPACE_IDS || "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function hasExplicitLegacyGrandfatherAccess(workspaceId: string): boolean {
  return arLegacyGrandfatherWorkspaceIds().has(workspaceId);
}

/**
 * Pre-launch Appointment Reminders users (calendar and/or platform config) never hit
 * `/product-open?plan=free` — grant Free automatically instead of 403 on settings.
 */
async function workspaceQualifiesForArLegacyFreeAccess(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const [setup, calendar, appointment] = await Promise.all([
    prisma.solutionSetup.findFirst({
      where: { workspaceId, solutionType: APPOINTMENTS_SOLUTION_TYPE },
      select: { id: true },
    }),
    prisma.voiceCalendarConnection.findFirst({
      where: { workspaceId },
      select: { id: true },
    }),
    prisma.voiceAppointment.findFirst({
      where: { workspaceId },
      select: { id: true },
    }),
  ]);
  return Boolean(setup || calendar || appointment);
}

function freeCommercialSnapshot(
  limits: Record<string, unknown>,
): ArWorkspaceCommercialSnapshot {
  const startedRaw = limits[LIMITS_FREE_STARTED];
  const started =
    typeof startedRaw === "string" ? new Date(startedRaw) : new Date(String(startedRaw || Date.now()));
  const anchor = Number.isNaN(started.getTime()) ? new Date() : started;
  return {
    planKey: "free",
    hasProductAccess: true,
    usagePeriod: rollingFreeMonthPeriod(anchor),
    stripeSubscriptionId: null,
    stripeStatus: "free",
    cancelAtPeriodEnd: false,
    paidThrough: null,
    isLegacyGrandfather: false,
  };
}

async function workspaceLimitsRecord(workspaceId: string): Promise<Record<string, unknown>> {
  const row = await getPrisma().workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  return asRecord(row?.limits);
}

/**
 * Authoritative workspace AR commercial state — plan, period, and access.
 */
export async function resolveArWorkspaceCommercial(
  workspaceId: string,
): Promise<ArWorkspaceCommercialSnapshot> {
  const prisma = getPrisma();
  const sub = await prisma.platformProductSubscription.findUnique({
    where: {
      workspaceId_productFamily: { workspaceId, productFamily: AR_PLATFORM_PRODUCT_FAMILY },
    },
  });

  if (sub && ACTIVE_SUB_STATUSES.has(sub.status) && isArPlanKey(sub.tier)) {
    const period =
      stripeSubscriptionPeriod(sub.usagePeriodStart ?? sub.currentPeriodStart, sub.usagePeriodEnd ?? sub.currentPeriodEnd) ??
      stripeSubscriptionPeriod(sub.currentPeriodStart, sub.currentPeriodEnd) ??
      legacyGrandfatherPeriod();
    return {
      planKey: sub.tier as ArPlanKey,
      hasProductAccess: true,
      usagePeriod: period,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeStatus: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      paidThrough: sub.currentPeriodEnd,
      isLegacyGrandfather: false,
    };
  }

  const limits = await workspaceLimitsRecord(workspaceId);
  const storedPlan = String(limits[LIMITS_PLAN_KEY] || "");
  if (storedPlan === "free") {
    return freeCommercialSnapshot(limits);
  }

  if (hasExplicitLegacyGrandfatherAccess(workspaceId)) {
    return {
      planKey: "business",
      hasProductAccess: true,
      usagePeriod: legacyGrandfatherPeriod(),
      stripeSubscriptionId: null,
      stripeStatus: "legacy_grandfather",
      cancelAtPeriodEnd: false,
      paidThrough: null,
      isLegacyGrandfather: true,
    };
  }

  if (await workspaceQualifiesForArLegacyFreeAccess(workspaceId)) {
    await assignArFreePlan(workspaceId);
    const limitsAfter = await workspaceLimitsRecord(workspaceId);
    return freeCommercialSnapshot(limitsAfter);
  }

  return {
    planKey: "free",
    hasProductAccess: false,
    usagePeriod: legacyGrandfatherPeriod(),
    stripeSubscriptionId: null,
    stripeStatus: "none",
    cancelAtPeriodEnd: false,
    paidThrough: null,
    isLegacyGrandfather: false,
  };
}

/** Paid Stripe subscription replaces internal free marker (usage period follows Stripe). */
export async function clearArFreePlanMarker(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const limits = await workspaceLimitsRecord(workspaceId);
  if (!limits[LIMITS_PLAN_KEY]) return;
  const next = { ...limits };
  delete next[LIMITS_PLAN_KEY];
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: { workspaceId, limits: next },
    update: { limits: next },
  });
}

export async function assignArFreePlan(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const limits = await workspaceLimitsRecord(workspaceId);
  const startedAt = limits[LIMITS_FREE_STARTED] ?? new Date().toISOString();
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        ...limits,
        [LIMITS_PLAN_KEY]: "free",
        [LIMITS_FREE_STARTED]: startedAt,
      },
    },
    update: {
      limits: {
        ...limits,
        [LIMITS_PLAN_KEY]: "free",
        [LIMITS_FREE_STARTED]: startedAt,
      },
    },
  });
}

export function arPlanLimitsForWorkspace(commercial: ArWorkspaceCommercialSnapshot) {
  return arPlanDefinition(commercial.planKey);
}
