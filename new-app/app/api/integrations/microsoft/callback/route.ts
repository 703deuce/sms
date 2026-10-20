import { NextResponse } from "next/server";
import {
  completeMicrosoftOAuth,
  microsoftOAuthErrorRedirect,
  microsoftOAuthSuccessRedirect,
} from "@/lib/calendar/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(microsoftOAuthErrorRedirect(error || "missing_code"));
  }

  try {
    const parsed = await completeMicrosoftOAuth(code, state);
    return NextResponse.redirect(microsoftOAuthSuccessRedirect(parsed.returnTo));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(microsoftOAuthErrorRedirect(msg));
  }
}
