/**
 * @deprecated Import from `@/lib/calendar` — workspace calendar integrations are platform-level.
 */
export {
  CALENDAR_INTEGRATIONS_PATH,
  GOOGLE_OAUTH_CALLBACK_PATH,
  LEGACY_GOOGLE_OAUTH_CALLBACK_PATH,
  completeGoogleOAuth,
  completeMicrosoftOAuth,
  getGoogleOAuthCallbackPath,
  getGoogleOAuthStartUrl,
  getMicrosoftOAuthStartUrl,
  googleOAuthErrorRedirect,
  googleOAuthSuccessRedirect,
  microsoftOAuthErrorRedirect,
  microsoftOAuthSuccessRedirect,
  parseOAuthState,
} from "@/lib/calendar/oauth";
