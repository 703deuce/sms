import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

export type WorkspaceDialPolicy = {
  minMinutesBetweenCallsToPhone: number;
  maxCallsToPhonePerDay: number;
  allowedAreaCodes: string[];
  blockedAreaCodes: string[];
};

const DEFAULT_POLICY: WorkspaceDialPolicy = {
  minMinutesBetweenCallsToPhone: 0,
  maxCallsToPhonePerDay: 0,
  allowedAreaCodes: [],
  blockedAreaCodes: [],
};

export async function getWorkspaceDialPolicy(workspaceId: string): Promise<WorkspaceDialPolicy> {
  const prisma = getPrisma();
  const row = await prisma.workspaceCrmSettings.findUnique({ where: { workspaceId } });
  const raw =
    row?.dialPolicyJson && typeof row.dialPolicyJson === "object"
      ? (row.dialPolicyJson as Record<string, unknown>)
      : {};
  return {
    minMinutesBetweenCallsToPhone:
      typeof raw.minMinutesBetweenCallsToPhone === "number" ? raw.minMinutesBetweenCallsToPhone : 0,
    maxCallsToPhonePerDay:
      typeof raw.maxCallsToPhonePerDay === "number" ? raw.maxCallsToPhonePerDay : 0,
    allowedAreaCodes: Array.isArray(raw.allowedAreaCodes)
      ? raw.allowedAreaCodes.map(String)
      : [],
    blockedAreaCodes: Array.isArray(raw.blockedAreaCodes)
      ? raw.blockedAreaCodes.map(String)
      : [],
  };
}

/** NANP area code (3 digits) when +1. */
export function areaCodeFromE164(e164: string): string | null {
  try {
    const n = normalizeE164(e164).replace(/\D/g, "");
    if (n.length === 11 && n.startsWith("1")) return n.slice(1, 4);
    return null;
  } catch {
    return null;
  }
}

export function areaCodeAllowed(
  e164: string,
  campaignAllowed: string[],
  campaignBlocked: string[],
  workspace: WorkspaceDialPolicy,
): { ok: boolean; reason?: string } {
  const ac = areaCodeFromE164(e164);
  if (!ac) return { ok: true };
  const blocked = new Set([...workspace.blockedAreaCodes, ...campaignBlocked]);
  if (blocked.has(ac)) return { ok: false, reason: "area_code_blocked" };
  const allowed = campaignAllowed.length ? campaignAllowed : workspace.allowedAreaCodes;
  if (allowed.length && !allowed.includes(ac)) return { ok: false, reason: "area_code_not_allowed" };
  return { ok: true };
}

/** P22 — workspace-wide frequency to same phone across campaigns. */
export async function checkWorkspacePhoneFrequency(
  workspaceId: string,
  e164: string,
  now: Date,
  policy: WorkspaceDialPolicy,
): Promise<{ ok: boolean; reason?: string; retryEligibleAt?: Date }> {
  if (!policy.minMinutesBetweenCallsToPhone && !policy.maxCallsToPhonePerDay) {
    return { ok: true };
  }
  const prisma = getPrisma();
  const phone = normalizeE164(e164);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const recent = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      endedAt: { not: null },
      contact: { phone },
    },
    orderBy: { endedAt: "desc" },
    take: 50,
    select: { endedAt: true },
  });

  if (policy.minMinutesBetweenCallsToPhone > 0 && recent[0]?.endedAt) {
    const next = new Date(
      recent[0].endedAt.getTime() + policy.minMinutesBetweenCallsToPhone * 60_000,
    );
    if (now < next) {
      return { ok: false, reason: "workspace_phone_cooldown", retryEligibleAt: next };
    }
  }

  if (policy.maxCallsToPhonePerDay > 0) {
    const todayCount = recent.filter((a) => a.endedAt && a.endedAt >= dayStart).length;
    if (todayCount >= policy.maxCallsToPhonePerDay) {
      return { ok: false, reason: "workspace_phone_daily_cap" };
    }
  }

  return { ok: true };
}
