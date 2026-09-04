import { NextResponse } from "next/server";
import { exchangeSquareOAuthCode } from "@/lib/merchant-payments/square";
import { cookies } from "next/headers";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

const OAUTH_COOKIE = "square_oauth_state";

export async function GET(request: Request) {
  const base = getAppBaseUrl();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${base}/settings/payments?square=error`);
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);

  if (!code || !state || !raw) {
    return NextResponse.redirect(`${base}/settings/payments?square=error`);
  }

  let parsed: { state: string; workspaceId: string };
  try {
    parsed = JSON.parse(raw) as { state: string; workspaceId: string };
  } catch {
    return NextResponse.redirect(`${base}/settings/payments?square=error`);
  }

  if (parsed.state !== state) {
    return NextResponse.redirect(`${base}/settings/payments?square=csrf`);
  }

  try {
    await exchangeSquareOAuthCode(parsed.workspaceId, code);
    return NextResponse.redirect(`${base}/settings/payments?square=connected`);
  } catch {
    return NextResponse.redirect(`${base}/settings/payments?square=error`);
  }
}
