/**
 * Fresh-customer MCTB certification lane — auth only (DEV_AUTH_BYPASS_2=1).
 *
 * Does not replace DEV_AUTH_BYPASS / ws_1. Creates or loads a separate user;
 * does not call MCTB bootstrap, ingress provisioning, or onboarding mutations.
 *
 * GET /api/auth/dev-bypass-2?next=/api/products/open?product=voice&next=/mctb
 */
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import {
  devAuthBypass2Allowed,
  devAuthBypass2EmailHint,
  devAuthBypass2ForbiddenWorkspaceIds,
  devAuthBypassEmailHint,
  safeDevBypassNextPath,
} from "@/lib/auth/dev-auth-bypass";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { applyProductAccessCookie } from "@/lib/products/session";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { getPrisma } from "@/lib/db";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";

type AuthScaffoldReport = {
  createdUser: boolean;
  email: string;
  userId: string;
  membershipWorkspaceIds: string[];
  sessionOnly: boolean;
};

async function findBypassUser(emailHint: string) {
  const prisma = getPrisma();
  const normalized = emailHint.trim().toLowerCase();
  if (normalized.includes("@")) {
    return prisma.user.findUnique({ where: { email: normalized } });
  }
  return prisma.user.findFirst({
    where: { email: { startsWith: normalized } },
    orderBy: { createdAt: "asc" },
  });
}

/** Minimum user row for bypass 2 — no workspace, no MCTB config. */
async function ensureBypass2User(email: string): Promise<{ user: { id: string; email: string; name: string | null; isPlatformAdmin: boolean }; created: boolean }> {
  const existing = await findBypassUser(email);
  if (existing) {
    return { user: existing, created: false };
  }
  const passwordHash = await hash(randomBytes(24).toString("hex"), 10);
  const user = await getPrisma().user.create({
    data: {
      email,
      name: "MCTB Fresh Cert",
      passwordHash,
      isPlatformAdmin: false,
    },
  });
  return { user, created: true };
}

export async function GET(request: Request) {
  if (!devAuthBypass2Allowed(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const emailHint = (url.searchParams.get("email") || devAuthBypass2EmailHint()).trim().toLowerCase();
  const bypass1Email = devAuthBypassEmailHint();
  if (emailHint === bypass1Email) {
    return NextResponse.json(
      {
        error:
          "Bypass 2 email must differ from DEV_AUTH_BYPASS_EMAIL (ws_1 cert owner). Set DEV_AUTH_BYPASS_2_EMAIL.",
      },
      { status: 400 },
    );
  }

  const forbidden = new Set(devAuthBypass2ForbiddenWorkspaceIds());
  const { user, created: createdUser } = await ensureBypass2User(emailHint);

  const memberships = await getPrisma().membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true, type: true } } },
  });

  const memberIds = memberships.map((m) => m.workspaceId);
  const hitsForbidden = memberIds.filter((id) => forbidden.has(id));
  if (hitsForbidden.length) {
    return NextResponse.json(
      {
        error: `Bypass 2 user is a member of forbidden workspace(s): ${hitsForbidden.join(", ")}. Use a dedicated DEV_AUTH_BYPASS_2_EMAIL identity.`,
        userId: user.id,
        email: user.email,
      },
      { status: 403 },
    );
  }

  const allowedMemberships = memberships.filter((m) => !forbidden.has(m.workspaceId));
  const sessionOnly = allowedMemberships.length === 0;

  const scaffold: AuthScaffoldReport = {
    createdUser,
    email: user.email,
    userId: user.id,
    membershipWorkspaceIds: memberIds,
    sessionOnly,
  };

  const access = await getUserProductAccess(user.id);
  const session = {
    userId: user.id,
    email: user.email,
    name: user.name || user.email,
    isAdmin: Boolean(user.isPlatformAdmin),
  };

  const defaultNext =
    "/api/products/open?product=voice&next=" + encodeURIComponent("/mctb");
  const nextPath = safeDevBypassNextPath(url.searchParams.get("next") || defaultNext);

  const res = NextResponse.redirect(publicRedirectUrl(nextPath, request), 302);
  applySessionCookie(res, session);

  if (!sessionOnly) {
    let membership = allowedMemberships[0];
    const { resolvePreferredBusinessWorkspaceId } = await import(
      "@/lib/workspace/preferred-business-workspace"
    );
    const preferredId = await resolvePreferredBusinessWorkspaceId(user.id, membership.workspaceId);
    const preferred = allowedMemberships.find((m) => m.workspaceId === preferredId);
    if (preferred) membership = preferred;
    applyWorkspaceCookies(
      res,
      membership.workspaceId,
      membership.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    );
  }

  applyProductAccessCookie(res, access);
  res.headers.set("x-transovo-bypass-lane", "2");
  res.headers.set("x-transovo-bypass-2-scaffold", JSON.stringify(scaffold));
  return res;
}
