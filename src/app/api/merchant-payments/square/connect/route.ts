import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { buildSquareOAuthUrl, isSquarePlatformConfigured } from "@/lib/merchant-payments/square";
import { createId } from "@/lib/supabase/id";
import { cookies } from "next/headers";

const OAUTH_COOKIE = "square_oauth_state";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!isSquarePlatformConfigured()) {
      return NextResponse.json(
        { error: "Square is not configured. Set SQUARE_APPLICATION_ID and SQUARE_APPLICATION_SECRET." },
        { status: 503 },
      );
    }

    const state = createId();
    const cookieStore = await cookies();
    cookieStore.set(OAUTH_COOKIE, JSON.stringify({ state, workspaceId: auth.workspaceId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const url = buildSquareOAuthUrl(auth.workspaceId, state);
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
