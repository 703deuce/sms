import "server-only";

import { getPrisma } from "@/lib/db";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function workspaceHasAiTranscriptionEntitlement(
  workspaceId: string,
): Promise<boolean> {
  return hasWorkspaceProductFeature(workspaceId, "ai_transcription");
}

export type TranscriptionAllowance = {
  entitled: boolean;
  tier: string | null;
  includedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
};

export async function getTranscriptionAllowance(
  workspaceId: string,
): Promise<TranscriptionAllowance> {
  const entitled = await workspaceHasAiTranscriptionEntitlement(workspaceId);
  if (!entitled) {
    return {
      entitled: false,
      tier: null,
      includedMinutes: 0,
      usedMinutes: 0,
      remainingMinutes: 0,
    };
  }

  const prisma = getPrisma();
  const sub = await prisma.platformProductSubscription.findFirst({
    where: {
      workspaceId,
      productFamily: "ai_transcription",
      status: { in: ["active", "trialing", "past_due"] },
    },
  });

  const includedMinutes = sub?.includedMinutes ?? 0;
  const usedMinutes = sub?.transcriptionMinutesUsedThisPeriod ?? 0;
  return {
    entitled: true,
    tier: sub?.tier ?? null,
    includedMinutes,
    usedMinutes,
    remainingMinutes: Math.max(0, includedMinutes - usedMinutes),
  };
}

export async function canTranscribeRecording(input: {
  workspaceId: string;
  estimatedMinutes?: number;
}): Promise<{ allowed: boolean; reason?: string }> {
  const allowance = await getTranscriptionAllowance(input.workspaceId);
  if (!allowance.entitled) {
    return { allowed: false, reason: "not_entitled" };
  }
  const need = Math.max(1, input.estimatedMinutes ?? 1);
  if (allowance.remainingMinutes < need) {
    return { allowed: false, reason: "limit_reached" };
  }
  return { allowed: true };
}
