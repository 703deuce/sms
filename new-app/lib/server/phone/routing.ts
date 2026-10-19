import { ROUTE_POLICY_DEFAULT } from "@/lib/data";
import type { RoutePolicyDto } from "@/lib/phone/types";
import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";

export const DEFAULT_POLICY = ROUTE_POLICY_DEFAULT;

export async function getCallRouting(workspaceId: string): Promise<RoutePolicyDto> {
  const prisma = getPrisma();
  const row = await prisma.workspaceCallRouting.findUnique({ where: { workspaceId } });
  const policy = (row?.policyJson || DEFAULT_POLICY) as typeof DEFAULT_POLICY;
  return {
    numberId: policy.numberId ?? null,
    duringHours: policy.duringHours,
    ringStrategy: policy.ringStrategy,
    ringTimeout: policy.ringTimeout,
    noAnswer: policy.noAnswer,
    afterHours: policy.afterHours,
    aiCoverage: policy.aiCoverage,
    mctbEnabled: policy.mctbEnabled,
    updatedAt: policy.updatedAt || row?.updatedAt.toISOString() || new Date().toISOString(),
    updatedBy: policy.updatedBy || "System",
    greetingText: row?.greetingText ?? null,
    greetingUrl: row?.greetingUrl ?? null,
    providerSyncStatus: row?.providerSyncStatus ?? "pending",
    providerSyncError: row?.providerSyncError ?? null,
  };
}

export async function saveCallRouting(
  workspaceId: string,
  input: {
    policy: Partial<typeof DEFAULT_POLICY>;
    greetingText?: string | null;
    greetingUrl?: string | null;
  },
): Promise<RoutePolicyDto> {
  const prisma = getPrisma();
  const existing = await prisma.workspaceCallRouting.findUnique({ where: { workspaceId } });
  const base = (existing?.policyJson || DEFAULT_POLICY) as typeof DEFAULT_POLICY;
  const merged = {
    ...base,
    ...input.policy,
    updatedAt: new Date().toISOString(),
    updatedBy: `Operator · via Phone`,
  };

  const row = await prisma.workspaceCallRouting.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      policyJson: merged,
      greetingText: input.greetingText ?? null,
      greetingUrl: input.greetingUrl ?? null,
      providerSyncStatus: "synced",
      revision: 1,
    },
    update: {
      policyJson: merged,
      ...(input.greetingText !== undefined ? { greetingText: input.greetingText } : {}),
      ...(input.greetingUrl !== undefined ? { greetingUrl: input.greetingUrl } : {}),
      providerSyncStatus: "synced",
      providerSyncError: null,
      revision: (existing?.revision ?? 0) + 1,
    },
  });

  // Extension point: AI Receptionist / MCTB read `workspaceCallRouting.policyJson` — no duplicate store.
  void resolveInternalUserId();

  return getCallRouting(workspaceId);
}

export async function getBusinessHours(workspaceId: string) {
  const prisma = getPrisma();
  const row = await prisma.workspaceMessagingSettings.findUnique({ where: { workspaceId } });
  return {
    timezone: row?.timezone ?? "America/Chicago",
    hours: row?.businessHoursJson ?? null,
  };
}

export async function saveBusinessHours(
  workspaceId: string,
  input: { timezone?: string; businessHoursJson: unknown },
) {
  const prisma = getPrisma();
  return prisma.workspaceMessagingSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      timezone: input.timezone ?? "America/Chicago",
      businessHoursJson: input.businessHoursJson as object,
    },
    update: {
      ...(input.timezone ? { timezone: input.timezone } : {}),
      businessHoursJson: input.businessHoursJson as object,
    },
  });
}
