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
  ensureProductWorkspace,
  getUserProductAccess,
  grantProductEntitlement,
  resolveWorkspaceForProduct,
} from "@/lib/products/entitlements";
import { preferredProductFromPath, resolvePostLoginPath } from "@/lib/products/routing";
import { applyProductAccessCookie, updateLastActiveProduct, updateProductIntent } from "@/lib/products/session";

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

    let workspaceId = account.workspaceId;
    let workspaceType = account.workspaceType;

    if (pathProduct === "voice") {
      const voiceWs = await ensureProductWorkspace(account.userId, "voice");
      workspaceId = voiceWs.workspaceId;
      workspaceType = voiceWs.workspaceType;
      const { ensureMctbWorkspaceSeeded } = await import(
        "@/lib/mctb/provisioning/seed-workspace"
      );
      await ensureMctbWorkspaceSeeded(workspaceId);
      await grantProductEntitlement(workspaceId, "voice", "active");
      await updateLastActiveProduct(account.userId, "voice");
      await updateProductIntent(account.userId, "voice");
    } else if (pathProduct) {
      const ws = await ensureProductWorkspace(account.userId, pathProduct);
      workspaceId = ws.workspaceId;
      workspaceType = ws.workspaceType;
    } else {
      const workspaceForProduct = await resolveWorkspaceForProduct(
        account.userId,
        access.lastActiveProduct || access.productIntent || "voice",
      );
      if (workspaceForProduct) {
        workspaceId = workspaceForProduct.workspaceId;
        workspaceType = workspaceForProduct.workspaceType;
      }
    }

    const refreshedAccess = pathProduct === "voice" ? await getUserProductAccess(account.userId) : access;
    const redirectPath = resolvePostLoginPath(refreshedAccess, { nextPath });

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
    applyProductAccessCookie(res, refreshedAccess);
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
