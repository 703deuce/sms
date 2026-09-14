import "server-only";

/**
 * Canonical Microsoft OAuth token lifecycle for calendar Graph access.
 * Voice AI Booking, MCTB AI Booking, readiness, and calendar writes must use this path only.
 */
export {
  getValidAccessToken,
  hasOAuthTokens,
  microsoftGraphFetch,
  type CalendarConfig,
} from "@/lib/calendar/providers";

export {
  getMicrosoftOAuthScopes,
  getMicrosoftRedirectUri,
  getMicrosoftAuthorizeUrl,
  getMicrosoftTokenUrl,
  isMicrosoftOAuthConfigured,
  refreshMicrosoftAccessToken,
} from "@/lib/microsoft/oauth-config";

export { withMicrosoftTokenRefreshLock } from "@/lib/microsoft/token-refresh-lock";
