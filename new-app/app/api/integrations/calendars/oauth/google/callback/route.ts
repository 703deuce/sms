import { NextResponse } from "next/server";
import {
  completeGoogleOAuth,
  googleOAuthErrorRedirect,
  googleOAuthSuccessRedirect,
} from "@/lib/calendar/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(googleOAuthErrorRedirect(error || "missing_code"));
  }

  try {
    const parsed = await completeGoogleOAuth(code, state);
    return NextResponse.redirect(googleOAuthSuccessRedirect(parsed.returnTo));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(googleOAuthErrorRedirect(msg));
  }
}
