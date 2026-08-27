/**
 * Dev/cert session — skips login UI when DEV_AUTH_BYPASS=1.
 * Establishes a real session for the owner Google account (no password required).
 *
 * GET /api/auth/dev-bypass?next=/dashboard
 *
 * Remove DEV_AUTH_BYPASS from env when re-enabling normal login.
 */
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import {
  devAuthBypassAllowed,
  devAuthBypassEmailHint,
  safeDevBypassNextPath,
} from "@/lib/auth/dev-auth-bypass";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { applyProductAccessCookie } from "@/lib/products/session";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { getPrisma } from "@/lib/db";

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

export async function GET(request: Request) {
  if (!devAuthBypassAllowed(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const emailHint = (url.searchParams.get("email") || devAuthBypassEmailHint()).trim();

  const user = await findBypassUser(emailHint);
  if (!user) {
    return NextResponse.json(
      {
        error: `Dev bypass user not found for "${emailHint}". Set DEV_AUTH_BYPASS_EMAIL in .env.local.`,
      },
      { status: 404 },
    );
  }

  const memberships = await getPrisma().membership.findMany({
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
  const preferred = memberships.find((m: (typeof memberships)[number]) => m.workspaceId === preferredId);
  if (preferred) membership = preferred;

  const access = await getUserProductAccess(user.id);
  const session = {
    userId: user.id,
    email: user.email,
    name: user.name || user.email,
    isAdmin: Boolean(user.isPlatformAdmin),
  };

  const res = NextResponse.redirect(new URL(safeDevBypassNextPath(url.searchParams.get("next")), url.origin), 302);
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
