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
    return NextResponse.redirect(
      microsoftOAuthErrorRedirect(error || "missing_code"),
    );
  }

  try {
    const parsed = await completeMicrosoftOAuth(code, state);
    try {
      const { verifyWorkspaceCalendarConnection } = await import("@/lib/calendar/connection-settings");
      await verifyWorkspaceCalendarConnection(parsed.workspaceId, parsed.connectionId);
    } catch (verifyErr) {
      console.warn("[calendar] microsoft post-oauth verify failed", verifyErr);
    }
    try {
      const { getWorkspaceCalendarConnection } = await import("@/lib/calendar/connections");
      const { enqueueCalendarConnectionSync } = await import("@/lib/calendar/import-sync");
      const conn = await getWorkspaceCalendarConnection(parsed.workspaceId, parsed.connectionId);
      const cfg = (conn?.config || {}) as { importCalendarIds?: string[] };
      if (cfg.importCalendarIds?.length) {
        await enqueueCalendarConnectionSync(parsed.workspaceId, parsed.connectionId, false, {
          priority: 25,
          wake: true,
        });
      }
    } catch (syncErr) {
      console.warn("[calendar] microsoft post-oauth sync enqueue failed", syncErr);
    }
    return NextResponse.redirect(microsoftOAuthSuccessRedirect(parsed.returnTo));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(microsoftOAuthErrorRedirect(msg));
  }
}
