import "server-only";

import { isSameMicrosoftAccount } from "@/lib/calendar/microsoft-canonical-connection";
import { updateWorkspaceCalendarConnection, getWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getValidAccessToken } from "@/lib/calendar/providers";
import { snapshotMicrosoftConnectionDiagnostics } from "@/lib/microsoft/connection-diagnostics";
import { getPrisma } from "@/lib/db";

const OAUTH_TOKEN_KEYS = [
  "accessToken",
  "refreshToken",
  "expiresAt",
  "grantedScopes",
  "microsoftUserId",
  "tenantId",
  "accountType",
  "email",
  "displayName",
] as const;

function oauthTokenPatch(from: CalendarConfig): Partial<CalendarConfig> {
  const patch: Partial<CalendarConfig> = {};
  for (const key of OAUTH_TOKEN_KEYS) {
    const value = from[key];
    if (value !== undefined && value !== null && value !== "") {
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  patch.lastTokenRefreshError = null;
  patch.lastTokenRefreshKind = "healed_from_sibling";
  patch.lastTokenRefreshAt = new Date().toISOString();
  return patch;
}

export type MicrosoftConnectionHealResult = {
  healed: boolean;
  targetConnectionId: string;
  donorConnectionId?: string;
  reason?: string;
};

/**
 * When the same Microsoft account was connected twice, imports may remain on a row whose
 * refresh token is dead while a newer row still refreshes. Copy live OAuth credentials onto
 * the import-enabled row (same microsoftUserId / email only).
 */
export async function healMicrosoftSplitConnectionTokens(
  workspaceId: string,
  targetConnectionId: string,
): Promise<MicrosoftConnectionHealResult> {
  const target = await getWorkspaceCalendarConnection(workspaceId, targetConnectionId);
  if (!target || target.provider !== "microsoft") {
    return { healed: false, targetConnectionId, reason: "not_microsoft" };
  }

  const targetConfig = (target.config || {}) as CalendarConfig;
  const targetSnap = snapshotMicrosoftConnectionDiagnostics({
    connectionId: target.id,
    status: target.status,
    config: targetConfig,
  });
  if (targetSnap.accessTokenCurrentlyValid) {
    return { healed: false, targetConnectionId, reason: "target_access_valid" };
  }

  const prisma = getPrisma();
  const siblings = await prisma.voiceCalendarConnection.findMany({
    where: {
      workspaceId,
      provider: "microsoft",
      id: { not: targetConnectionId },
      status: { in: ["connected", "needs_reauth"] },
    },
  });

  for (const donor of siblings) {
    const donorConfig = (donor.config || {}) as CalendarConfig;
    if (!isSameMicrosoftAccount(targetConfig, donorConfig)) continue;

    const donorToken = await getValidAccessToken(donor.id, "microsoft", donorConfig, {
      mutationSource: "manual_admin",
    });
    if (!donorToken) continue;

    const donorFresh = await getWorkspaceCalendarConnection(workspaceId, donor.id);
    const donorCfg = (donorFresh?.config || {}) as CalendarConfig;
    await updateWorkspaceCalendarConnection(workspaceId, targetConnectionId, {
      status: "connected",
      config: oauthTokenPatch(donorCfg) as Record<string, unknown>,
    });

    const donorHasImports = (donorCfg.importCalendarIds?.length ?? 0) > 0;
    if (!donorHasImports) {
      await updateWorkspaceCalendarConnection(workspaceId, donor.id, {
        status: "disconnected",
        config: {
          replacedByConnectionId: targetConnectionId,
          replacedAt: new Date().toISOString(),
          replaceReason: "oauth_token_heal",
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
        },
      });
    }

    return {
      healed: true,
      targetConnectionId,
      donorConnectionId: donor.id,
      reason: "copied_oauth_from_sibling",
    };
  }

  return { healed: false, targetConnectionId, reason: "no_healthy_sibling" };
}
