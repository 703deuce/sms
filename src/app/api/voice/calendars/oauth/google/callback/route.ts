import { NextResponse } from "next/server";
import { completeGoogleOAuth } from "@/lib/voice/calendar/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (error || !code || !state) {
    return NextResponse.redirect(`${base}/voice/calendars?oauth_error=${encodeURIComponent(error || "missing_code")}`);
  }

  try {
    await completeGoogleOAuth(code, state);
    return NextResponse.redirect(`${base}/voice/calendars?oauth=google_ok`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${base}/voice/calendars?oauth_error=${encodeURIComponent(msg)}`);
  }
}
