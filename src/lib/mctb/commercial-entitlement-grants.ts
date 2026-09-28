import "server-only";

import { getPrisma } from "@/lib/db";

const LIMITS_AI_ENTITLED = "mctbAiRecoveryEntitled";
const LIMITS_OWN_SENDER_ADDON = "mctbOwnSenderAddOnEntitled";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function setLimitsFlag(
  workspaceId: string,
  key: string,
  value: boolean,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const next = { ...limits, [key]: value };
  if (!row) {
    await prisma.workspaceLimits.create({ data: { workspaceId, limits: next } });
  } else {
    await prisma.workspaceLimits.update({
      where: { workspaceId },
      data: { limits: next },
    });
  }
}

export async function grantMctbAiRecoveryCommercialEntitlement(workspaceId: string): Promise<void> {
  await setLimitsFlag(workspaceId, LIMITS_AI_ENTITLED, true);
}

export async function revokeMctbAiRecoveryCommercialEntitlement(workspaceId: string): Promise<void> {
  await setLimitsFlag(workspaceId, LIMITS_AI_ENTITLED, false);
}

export async function grantMctbOwnSenderAddOnEntitlement(workspaceId: string): Promise<void> {
  await setLimitsFlag(workspaceId, LIMITS_OWN_SENDER_ADDON, true);
}

export async function revokeMctbOwnSenderAddOnEntitlement(workspaceId: string): Promise<void> {
  await setLimitsFlag(workspaceId, LIMITS_OWN_SENDER_ADDON, false);
}

export const MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS = {
  aiRecovery: "mctb_ai_recovery",
  ownSender: "mctb_own_sender",
} as const;

export function isMctbCommercialAddonProductKey(productKey: string): boolean {
  return (
    productKey === MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.aiRecovery ||
    productKey === MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.ownSender
  );
}

export async function applyMctbCommercialAddonProductKey(
  workspaceId: string,
  productKey: string,
  active: boolean,
): Promise<boolean> {
  if (productKey === MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.aiRecovery) {
    if (active) await grantMctbAiRecoveryCommercialEntitlement(workspaceId);
    else await revokeMctbAiRecoveryCommercialEntitlement(workspaceId);
    return true;
  }
  if (productKey === MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.ownSender) {
    if (active) await grantMctbOwnSenderAddOnEntitlement(workspaceId);
    else await revokeMctbOwnSenderAddOnEntitlement(workspaceId);
    return true;
  }
  return false;
}
