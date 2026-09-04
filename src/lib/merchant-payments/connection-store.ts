import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/framework/secrets";
import type {
  MerchantConnectionStatus,
  MerchantConnectionView,
  MerchantPaymentProvider,
} from "./types";

export type ConnectionRecord = {
  id: string;
  workspaceId: string;
  provider: string;
  status: string;
  merchantAccountId: string | null;
  defaultLocationId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  providerMetadata: unknown;
  lastError: string | null;
};

function mapStatus(row: ConnectionRecord): MerchantConnectionStatus {
  if (row.status === "disabled" || row.disconnectedAt) return "disabled";
  if (row.status === "needs_attention") return "needs_attention";
  if (row.onboardingComplete && row.chargesEnabled) return "connected";
  if (row.merchantAccountId || row.accessTokenEnc) return "onboarding_incomplete";
  return "not_connected";
}

export function toConnectionView(row: ConnectionRecord): MerchantConnectionView {
  const status = mapStatus(row);
  return {
    provider: row.provider as MerchantPaymentProvider,
    status,
    chargesEnabled: row.chargesEnabled,
    payoutsEnabled: row.payoutsEnabled,
    onboardingComplete: row.onboardingComplete,
    merchantAccountId: row.merchantAccountId,
    defaultLocationId: row.defaultLocationId,
    connectedAt: row.connectedAt?.toISOString() || null,
    lastError: row.lastError,
    canAcceptPayments: status === "connected" && row.chargesEnabled,
  };
}

export async function getMerchantConnection(
  workspaceId: string,
  provider: MerchantPaymentProvider,
): Promise<ConnectionRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.merchantPaymentConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  return row as ConnectionRecord | null;
}

export async function listMerchantConnections(workspaceId: string): Promise<MerchantConnectionView[]> {
  const prisma = getPrisma();
  const rows = await prisma.merchantPaymentConnection.findMany({
    where: { workspaceId },
  });
  const providers: MerchantPaymentProvider[] = ["STRIPE", "SQUARE"];
  const byProvider = new Map(rows.map((r) => [r.provider, r as ConnectionRecord]));
  return providers.map((provider) => {
    const row = byProvider.get(provider);
    if (!row) {
      return {
        provider,
        status: "not_connected" as MerchantConnectionStatus,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: false,
        merchantAccountId: null,
        defaultLocationId: null,
        connectedAt: null,
        lastError: null,
        canAcceptPayments: false,
      };
    }
    return toConnectionView(row);
  });
}

export async function upsertMerchantConnection(
  workspaceId: string,
  provider: MerchantPaymentProvider,
  patch: Partial<{
    status: string;
    merchantAccountId: string;
    defaultLocationId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    onboardingComplete: boolean;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    connectedAt: Date;
    disconnectedAt: Date | null;
    providerMetadata: Record<string, unknown>;
    lastError: string | null;
  }>,
): Promise<ConnectionRecord> {
  const prisma = getPrisma();
  const existing = await getMerchantConnection(workspaceId, provider);
  const data: Record<string, unknown> = {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.merchantAccountId !== undefined ? { merchantAccountId: patch.merchantAccountId } : {}),
    ...(patch.defaultLocationId !== undefined ? { defaultLocationId: patch.defaultLocationId } : {}),
    ...(patch.chargesEnabled !== undefined ? { chargesEnabled: patch.chargesEnabled } : {}),
    ...(patch.payoutsEnabled !== undefined ? { payoutsEnabled: patch.payoutsEnabled } : {}),
    ...(patch.onboardingComplete !== undefined ? { onboardingComplete: patch.onboardingComplete } : {}),
    ...(patch.accessToken !== undefined
      ? { accessTokenEnc: encryptIntegrationSecret(patch.accessToken) }
      : {}),
    ...(patch.refreshToken !== undefined
      ? { refreshTokenEnc: encryptIntegrationSecret(patch.refreshToken) }
      : {}),
    ...(patch.tokenExpiresAt !== undefined ? { tokenExpiresAt: patch.tokenExpiresAt } : {}),
    ...(patch.connectedAt !== undefined ? { connectedAt: patch.connectedAt } : {}),
    ...(patch.disconnectedAt !== undefined ? { disconnectedAt: patch.disconnectedAt } : {}),
    ...(patch.providerMetadata !== undefined ? { providerMetadata: patch.providerMetadata } : {}),
    ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
  };

  if (existing) {
    const row = await prisma.merchantPaymentConnection.update({
      where: { id: existing.id },
      data,
    });
    return row as ConnectionRecord;
  }

  const row = await prisma.merchantPaymentConnection.create({
    data: {
      id: createId(),
      workspaceId,
      provider,
      status: (patch.status as string) || "onboarding_incomplete",
      ...data,
    },
  });
  return row as ConnectionRecord;
}

export async function disconnectMerchantConnection(
  workspaceId: string,
  provider: MerchantPaymentProvider,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.merchantPaymentConnection.updateMany({
    where: { workspaceId, provider },
    data: {
      status: "disabled",
      chargesEnabled: false,
      disconnectedAt: new Date(),
      accessTokenEnc: null,
      refreshTokenEnc: null,
    },
  });
}

export function getDecryptedAccessToken(row: ConnectionRecord): string | null {
  if (!row.accessTokenEnc) return null;
  try {
    return decryptIntegrationSecret(row.accessTokenEnc);
  } catch {
    return null;
  }
}

export function getDecryptedRefreshToken(row: ConnectionRecord): string | null {
  if (!row.refreshTokenEnc) return null;
  try {
    return decryptIntegrationSecret(row.refreshTokenEnc);
  } catch {
    return null;
  }
}

export async function findConnectionByMerchantAccountId(
  merchantAccountId: string,
  provider: MerchantPaymentProvider,
): Promise<ConnectionRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.merchantPaymentConnection.findFirst({
    where: { merchantAccountId, provider },
  });
  return row as ConnectionRecord | null;
}
