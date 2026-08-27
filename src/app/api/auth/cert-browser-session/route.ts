/**
 * Local / env-gated browser session for Mass Texting certification.
 *
 * This is not a customer login skip. It 404s on public hosts unless
 * CERT_BROWSER_LOGIN_TOKEN is set. On localhost it also accepts the existing
 * smoke-bootstrap token as `?token=`.
 *
 * GET /api/auth/cert-browser-session?token=...&email=mt-cert-browser@transovo.test&next=/dashboard
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import {
  certBrowserRequestHost,
  isCertBrowserLoopbackHost,
  isCertBrowserPublicProductionHost,
} from "@/lib/auth/cert-browser-host";
import {
  devAuthBypassEmailHint,
  isDevAuthBypassEnabled,
} from "@/lib/auth/dev-auth-bypass";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { applyProductAccessCookie } from "@/lib/products/session";
import { getUserProductAccess, grantProductEntitlement } from "@/lib/products/entitlements";
import { getPrisma } from "@/lib/db";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";

const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";
const DEFAULT_EMAIL = "mt-cert-browser@transovo.test";

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function tokensEqual(provided: string, expected: string) {
  if (!provided || !expected) return false;
  return timingSafeEqual(sha256(provided), sha256(expected));
}

function requestHost(request: Request): string {
  return certBrowserRequestHost(request);
}

function isLoopbackHost(request: Request): boolean {
  return isCertBrowserLoopbackHost(requestHost(request));
}

function safeNextPath(raw: string | null): string {
  const next = (raw || "/dashboard").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) {
    return "/dashboard";
  }
  return next;
}

function isAuthorized(request: Request, token: string): "ok" | "missing" | "unauthorized" {
  const configured = process.env.CERT_BROWSER_LOGIN_TOKEN?.trim() || "";
  if (configured && tokensEqual(token, configured)) return "ok";
  if (isLoopbackHost(request) && tokensEqual(token, BOOTSTRAP_VALUE)) return "ok";
  if (!configured && !isLoopbackHost(request)) return "missing";
  return "unauthorized";
}

export async function GET(request: Request) {
  const host = certBrowserRequestHost(request);
  const devBypass = isDevAuthBypassEnabled();
  if (isCertBrowserPublicProductionHost(host) && !devBypass) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isCertBrowserPublicProductionHost(host) && devBypass) {
    // Production cert: owner Google account via DEV_AUTH_BYPASS_EMAIL (no password).
    const url = new URL(request.url);
    const emailHint = (url.searchParams.get("email") || devAuthBypassEmailHint()).trim();
    const prisma = getPrisma();
    const normalized = emailHint.toLowerCase();
    const user = normalized.includes("@")
      ? await prisma.user.findUnique({ where: { email: normalized } })
      : await prisma.user.findFirst({
          where: { email: { startsWith: normalized } },
          orderBy: { createdAt: "asc" },
        });
    if (!user) {
      return NextResponse.json({ error: `Cert user not found: ${emailHint}` }, { status: 404 });
    }
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true, type: true } } },
    });
    if (!memberships.length) {
      return NextResponse.json({ error: "User has no workspace" }, { status: 404 });
    }
    let membership = memberships[0];
    const { resolvePreferredBusinessWorkspaceId } = await import(
      "@/lib/workspace/preferred-business-workspace"
    );
    const preferredId = await resolvePreferredBusinessWorkspaceId(user.id, membership.workspaceId);
    const match = memberships.find((m: (typeof memberships)[number]) => m.workspaceId === preferredId);
    if (match) membership = match;
    await grantProductEntitlement(membership.workspaceId, "sms", "trial");
    const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
    await grantWorkspaceProductFeature(membership.workspaceId, "mass_texting", "trial");
    const access = await getUserProductAccess(user.id);
    const session = {
      userId: user.id,
      email: user.email,
      name: user.name || user.email,
      isAdmin: Boolean(user.isPlatformAdmin),
    };
    const res = NextResponse.redirect(
      publicRedirectUrl(safeNextPath(url.searchParams.get("next")), request),
      302,
    );
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    applyWorkspaceCookies(
      res,
      membership.workspaceId,
      membership.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    );
    applyProductAccessCookie(res, access);
    return res;
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const auth = isAuthorized(request, token);
  if (auth === "missing") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = (url.searchParams.get("email") || DEFAULT_EMAIL).trim().toLowerCase();
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "Cert user not found. Run scripts/seed-mass-texting-browser-cert.ts first." },
      { status: 404 },
    );
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true, type: true } } },
  });
  if (!memberships.length) {
    return NextResponse.json({ error: "User has no workspace" }, { status: 404 });
  }

  const requestedWorkspaceId = url.searchParams.get("workspaceId");
  let membership = memberships[0];
  if (requestedWorkspaceId) {
    const match = memberships.find((m: (typeof memberships)[number]) => m.workspaceId === requestedWorkspaceId);
    if (!match) {
      return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
    }
    membership = match;
  } else {
    const { resolvePreferredBusinessWorkspaceId } = await import(
      "@/lib/workspace/preferred-business-workspace"
    );
    const preferredId = await resolvePreferredBusinessWorkspaceId(user.id, membership.workspaceId);
    const match = memberships.find((m: (typeof memberships)[number]) => m.workspaceId === preferredId);
    if (match) membership = match;
  }

  await grantProductEntitlement(membership.workspaceId, "sms", "trial");
  const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
  await grantWorkspaceProductFeature(membership.workspaceId, "mass_texting", "trial");
  const access = await getUserProductAccess(user.id);

  const session = {
    userId: user.id,
    email: user.email,
    name: user.name || user.email,
    isAdmin: Boolean(user.isPlatformAdmin),
  };

  const res = NextResponse.redirect(publicRedirectUrl(safeNextPath(url.searchParams.get("next")), request), 302);
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  applyWorkspaceCookies(
    res,
    membership.workspaceId,
    membership.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
  );
  applyProductAccessCookie(res, access);
  return res;
}
