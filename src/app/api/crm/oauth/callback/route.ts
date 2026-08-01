import { NextResponse } from "next/server";
import { humanizeCrmError } from "@/lib/crm/human-errors";
import { completeCrmOAuth } from "@/lib/crm/oauth";
import { enqueueCrmSync } from "@/lib/crm/sync-engine";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    const human = humanizeCrmError(oauthError, "CRM connect");
    return NextResponse.redirect(
      `${appUrl()}/integrations/crm?connected_error=${encodeURIComponent(human.slice(0, 200))}`,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl()}/integrations/crm?connected_error=${encodeURIComponent(
        "Sign-in didn’t finish. Click Connect and try again.",
      )}`,
    );
  }

  try {
    const { workspaceId, provider } = await completeCrmOAuth(code, state);
    // Kick off initial sync in the background after connect.
    await enqueueCrmSync({
      workspaceId,
      provider,
      kind: "initial",
      triggeredBy: "oauth",
    }).catch(() => undefined);
    return NextResponse.redirect(
      `${appUrl()}/integrations/crm/${provider}?connected=1&wizard=1`,
    );
  } catch (err) {
    const msg = humanizeCrmError(err, "CRM connect");
    return NextResponse.redirect(
      `${appUrl()}/integrations/crm?connected_error=${encodeURIComponent(msg.slice(0, 200))}`,
    );
  }
}
