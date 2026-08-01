import { NextResponse } from "next/server";
import {
  completeExternalOAuth,
  isExternalProvider,
  parseExternalOAuthState,
} from "@/lib/integrations/framework";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl()}/integrations/native?connected_error=${encodeURIComponent(oauthError.slice(0, 200))}`,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl()}/integrations/native?connected_error=${encodeURIComponent(
        "Sign-in didn’t finish. Click Connect and try again.",
      )}`,
    );
  }

  const parsed = parseExternalOAuthState(state);
  if (!parsed || !isExternalProvider(raw) || parsed.provider !== raw) {
    return NextResponse.redirect(
      `${appUrl()}/integrations/native?connected_error=${encodeURIComponent(
        "Sign-in expired or provider mismatch. Click Connect and try again.",
      )}`,
    );
  }

  try {
    await completeExternalOAuth({
      code,
      state,
      extra: {
        location: url.searchParams.get("location"),
      },
    });
    return NextResponse.redirect(
      `${appUrl()}/integrations/native/${parsed.provider}?connected=1`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      `${appUrl()}/integrations/native?connected_error=${encodeURIComponent(message.slice(0, 200))}`,
    );
  }
}
