import { NextResponse } from "next/server";
import {
  LEGACY_GOOGLE_OAUTH_CALLBACK_PATH,
  completeGoogleOAuth,
  googleOAuthErrorRedirect,
  googleOAuthSuccessRedirect,
} from "@/lib/calendar/oauth";

/** Legacy Google OAuth callback — preserved for existing Google OAuth app redirect URIs. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(googleOAuthErrorRedirect(error || "missing_code"));
  }

  try {
    const parsed = await completeGoogleOAuth(code, state, LEGACY_GOOGLE_OAUTH_CALLBACK_PATH);
    return NextResponse.redirect(googleOAuthSuccessRedirect(parsed.returnTo));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(googleOAuthErrorRedirect(msg));
  }
}
