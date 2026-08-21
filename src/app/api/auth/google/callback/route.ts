import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import {
  exchangeGoogleAuthCode,
  findOrCreateUserFromGoogle,
  parseGoogleAuthState,
  sanitizeNextPath,
} from "@/lib/auth/google-oauth";
import { resolvePublicAppUrl } from "@/lib/integrations/framework/app-url";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import {
  getUserProductAccess,
  resolveWorkspaceForProduct,
} from "@/lib/products/entitlements";
import { preferredProductFromPath, resolvePostLoginPath } from "@/lib/products/routing";
import { applyProductAccessCookie } from "@/lib/products/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const appOrigin = resolvePublicAppUrl(request);

  const fallbackNext = sanitizeNextPath(null);
  const loginUrl = new URL("/login", appOrigin);
  loginUrl.searchParams.set("next", fallbackNext);

  if (oauthError) {
    loginUrl.searchParams.set("error", oauthError);
    return NextResponse.redirect(loginUrl);
  }

  if (!code || !stateRaw) {
    loginUrl.searchParams.set("error", "missing_oauth_code");
    return NextResponse.redirect(loginUrl);
  }

  const parsedState = parseGoogleAuthState(stateRaw);
  if (!parsedState) {
    loginUrl.searchParams.set("error", "invalid_oauth_state");
    return NextResponse.redirect(loginUrl);
  }

  const nextPath = sanitizeNextPath(parsedState.nextPath);

  try {
    const profile = await exchangeGoogleAuthCode(code);
    if (!profile.emailVerified) {
      loginUrl.searchParams.set("next", nextPath);
      loginUrl.searchParams.set("error", "google_email_unverified");
      return NextResponse.redirect(loginUrl);
    }

    const account = await findOrCreateUserFromGoogle(profile);
    const access = await getUserProductAccess(account.userId);
    const pathProduct = preferredProductFromPath(nextPath);
    const workspaceForProduct = pathProduct
      ? await resolveWorkspaceForProduct(account.userId, pathProduct)
      : null;
    const workspaceId = workspaceForProduct?.workspaceId ?? account.workspaceId;
    const workspaceType = workspaceForProduct?.workspaceType ?? account.workspaceType;
    const redirectPath = resolvePostLoginPath(access, { nextPath });

    const session = {
      userId: account.userId,
      email: account.email,
      name: account.name,
      isAdmin: false,
    };

    const res = NextResponse.redirect(new URL(redirectPath, appOrigin));
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    applyWorkspaceCookies(res, workspaceId, workspaceType === "PERSONAL" ? "PERSONAL" : "BUSINESS");
    applyProductAccessCookie(res, access);
    return res;
  } catch (err) {
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Google sign-in failed",
    );
    return NextResponse.redirect(loginUrl);
  }
}
