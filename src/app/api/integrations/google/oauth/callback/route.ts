import { NextResponse } from "next/server";
import { completeGoogleIntegrationOAuth } from "@/lib/integrations/oauth";
import { syncGoogleContacts } from "@/lib/integrations/sync";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (error || !code || !state) {
    return NextResponse.redirect(
      `${base}/integrations?connected_error=${encodeURIComponent(error || "missing_code")}`,
    );
  }

  try {
    const parsed = await completeGoogleIntegrationOAuth(code, state);
    // Import contacts immediately on connect when the token is present.
    if (parsed.provider === "google_contacts") {
      await syncGoogleContacts(parsed.workspaceId).catch((err) =>
        console.warn("[integrations] google contacts sync on connect failed", err),
      );
    }
    return NextResponse.redirect(`${base}/integrations?connected=${encodeURIComponent(parsed.provider)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(`${base}/integrations?connected_error=${encodeURIComponent(msg)}`);
  }
}
