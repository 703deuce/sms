import { NextResponse } from "next/server";
import {
  getGoogleAuthStartUrl,
  isGoogleAuthConfigured,
  sanitizeNextPath,
} from "@/lib/auth/google-oauth";
import { resolvePublicAppUrl } from "@/lib/integrations/framework/app-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));
  const reservationId = url.searchParams.get("reservation")?.trim() || undefined;
  const appOrigin = resolvePublicAppUrl(request);

  if (!isGoogleAuthConfigured()) {
    const loginUrl = new URL("/login", appOrigin);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const startUrl = getGoogleAuthStartUrl({ nextPath, reservationId });
    return NextResponse.redirect(startUrl);
  } catch (err) {
    const loginUrl = new URL("/login", appOrigin);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Google sign-in unavailable",
    );
    return NextResponse.redirect(loginUrl);
  }
}
