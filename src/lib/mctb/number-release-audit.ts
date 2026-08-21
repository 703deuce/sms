/**
 * Immutable audit trail when a workspace toll-free number is released.
 */
import { getPrisma } from "@/lib/db";
import { emitPlatformEvent } from "@/lib/platform/events";

export type NumberReleaseReason =
  | "trial_hold_expired"
  | "abandoned_onboarding"
  | "admin_manual"
  | "account_deletion"
  | "provider_cleanup"
  | "unknown";

export type NumberReleaseAuditInput = {
  workspaceId: string;
  phoneNumberId: string;
  e164: string;
  twilioSid?: string | null;
  provider?: string | null;
  reason: NumberReleaseReason;
  billingPlan?: string | null;
  stripeSubscriptionId?: string | null;
  mctbServiceStatus?: string | null;
  releasedBy?: "system" | "admin" | "user";
  metadata?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function recordNumberReleaseAudit(input: NumberReleaseAuditInput): Promise<void> {
  const prisma = getPrisma();
  const now = new Date().toISOString();

  const entry = {
    at: now,
    phoneNumberId: input.phoneNumberId,
    e164: input.e164,
    twilioSid: input.twilioSid || null,
    provider: input.provider || null,
    reason: input.reason,
    billingPlan: input.billingPlan || null,
    stripeSubscriptionId: input.stripeSubscriptionId || null,
    mctbServiceStatus: input.mctbServiceStatus || null,
    releasedBy: input.releasedBy || "system",
    metadata: input.metadata || {},
  };

  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const prior = Array.isArray(limits.numberReleaseAudit)
    ? (limits.numberReleaseAudit as Record<string, unknown>[])
    : [];

  await prisma.workspaceLimits.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      limits: { numberReleaseAudit: [entry] },
    },
    update: {
      limits: {
        ...limits,
        numberReleaseAudit: [...prior, entry].slice(-50),
        lastNumberReleaseAt: now,
        lastNumberReleaseReason: input.reason,
      },
    },
  });

  await emitPlatformEvent({
    workspaceId: input.workspaceId,
    type: "MCTB_NUMBER_RELEASED",
    payload: entry,
    idempotencyKey: `mctb-number-released:${input.workspaceId}:${input.phoneNumberId}:${now}`,
  }).catch(() => undefined);
}
