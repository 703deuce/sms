import { NextResponse } from "next/server";
import { applySessionCookie } from "@/lib/auth/session-cookie";
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
import { resolveAuthenticatedWorkspace } from "@/lib/auth/resolve-session-workspace";
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
    const isArPath =
      nextPath.includes("/appointment-reminders") ||
      nextPath.includes("appointment_reminders") ||
      nextPath.includes("/api/appointment-reminders/");
    const isMctbPath =
      !isArPath &&
      (nextPath.includes("/onboarding/mctb") ||
        nextPath.startsWith("/mctb") ||
        nextPath.startsWith("/voice/setup") ||
        nextPath.startsWith("/voice/missed-calls"));

    let workspaceId = account.workspaceId;
    let workspaceType = account.workspaceType;

    const wantsVoiceWorkspace =
      isMctbPath ||
      (!isArPath &&
        (pathProduct === "voice" ||
          access.lastActiveProduct === "voice" ||
          access.productIntent === "voice"));

    if (isArPath) {
      const voiceWs = account.created
        ? await ensureProductWorkspace(account.userId, "voice")
        : await resolveAuthenticatedWorkspace(account.userId, "voice");
      workspaceId = voiceWs.workspaceId;
      workspaceType = voiceWs.workspaceType;
      const { assignArFreePlan } = await import(
        "@/lib/appointment-reminders/commercial/ar-workspace-plan"
      );
      await Promise.all([
        assignArFreePlan(workspaceId),
        grantProductEntitlement(workspaceId, "voice", "active"),
      ]);
    } else if (wantsVoiceWorkspace) {
      const voiceWs = account.created
        ? await ensureProductWorkspace(account.userId, "voice")
        : await resolveAuthenticatedWorkspace(account.userId, "voice");
      workspaceId = voiceWs.workspaceId;
      workspaceType = voiceWs.workspaceType;
      const { ensureMctbWorkspaceBootstrap } = await import(
        "@/lib/mctb/provisioning/workspace-bootstrap"
      );
      const boot = await ensureMctbWorkspaceBootstrap(workspaceId);
      if (!boot.ok) {
        console.error("[auth/google] MCTB bootstrap", workspaceId, boot.error);
      }
      if (account.created || isMctbPath) {
        await grantProductEntitlement(workspaceId, "voice", "active");
        await updateLastActiveProduct(account.userId, "voice");
        await updateProductIntent(account.userId, "voice");
      }
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

    const refreshedAccess = wantsVoiceWorkspace
      ? await getUserProductAccess(account.userId)
      : access;
    const redirectPath = resolvePostLoginPath(refreshedAccess, { nextPath });

    const session = {
      userId: account.userId,
      email: account.email,
      name: account.name,
      isAdmin: false,
    };

    const res = NextResponse.redirect(new URL(redirectPath, appOrigin));
    applySessionCookie(res, session);
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
