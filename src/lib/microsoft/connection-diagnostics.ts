import "server-only";

import type { CalendarConfig } from "@/lib/calendar/providers";
import { hasOAuthTokens } from "@/lib/calendar/providers";
import { isMicrosoftOAuthConfigured } from "@/lib/microsoft/oauth-config";

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60_000;

export type MicrosoftConnectionDiagnosticSnapshot = {
  connectionId: string;
  status: string;
  refreshTokenPresent: boolean;
  accessTokenPresent: boolean;
  accessTokenExpiresAt: string | null;
  accessTokenCurrentlyValid: boolean;
  grantedScopes: string | null;
  lastTokenRefreshAt: string | null;
  lastTokenRefreshKind: string | null;
  lastTokenRefreshError: string | null;
  lastTokenRefreshSource: string | null;
  lastTokenRefreshBuildSha: string | null;
  lastVerifiedAt: string | null;
  lastVerificationOk: boolean | null;
  certificationHostOAuthConfigured: boolean;
};

/** Read-only inspection — never refreshes tokens or writes diagnostics. */
export function snapshotMicrosoftConnectionDiagnostics(input: {
  connectionId: string;
  status: string;
  config: CalendarConfig | null | undefined;
}): MicrosoftConnectionDiagnosticSnapshot {
  const config = input.config || {};
  const expiresAt = typeof config.expiresAt === "number" ? config.expiresAt : null;
  const accessValid =
    Boolean(config.accessToken) &&
    expiresAt != null &&
    expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS;

  return {
    connectionId: input.connectionId,
    status: input.status,
    refreshTokenPresent: Boolean(config.refreshToken),
    accessTokenPresent: Boolean(config.accessToken),
    accessTokenExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    accessTokenCurrentlyValid: accessValid,
    grantedScopes:
      typeof config.grantedScopes === "string"
        ? config.grantedScopes
        : typeof config.scope === "string"
          ? config.scope
          : null,
    lastTokenRefreshAt: config.lastTokenRefreshAt ?? null,
    lastTokenRefreshKind: config.lastTokenRefreshKind ?? null,
    lastTokenRefreshError: config.lastTokenRefreshError ?? null,
    lastTokenRefreshSource: config.lastTokenRefreshSource ?? null,
    lastTokenRefreshBuildSha: config.lastTokenRefreshBuildSha ?? null,
    lastVerifiedAt: config.lastVerifiedAt ?? null,
    lastVerificationOk:
      typeof config.lastVerificationOk === "boolean" ? config.lastVerificationOk : null,
    certificationHostOAuthConfigured: isMicrosoftOAuthConfigured(),
  };
}

export function hasOAuthTokensForConfig(config: CalendarConfig | null | undefined): boolean {
  return hasOAuthTokens(config);
}
