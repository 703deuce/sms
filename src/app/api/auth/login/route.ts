import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { PHONE_VERIFIED_COOKIE, readVerifiedPhone } from "@/lib/auth/phone-otp";
import { getPrisma } from "@/lib/db";
import { consumeBackupCode, decryptSecret, verifyTotp } from "@/lib/auth/totp";
import { CERT_BROWSER_EMAIL } from "@/lib/cert/appointments-mctb-browser-cert-constants";
import { resolveAuthenticatedWorkspace, userHasAnyWorkspaceAccess } from "@/lib/auth/resolve-session-workspace";
import {
  getUserProductAccess,
  grantProductEntitlement,
} from "@/lib/products/entitlements";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { preferredProductFromPath, resolvePostLoginPath } from "@/lib/products/routing";
import { applyProductAccessCookie } from "@/lib/products/session";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import type { ProductKey } from "@/lib/products/types";
import type { WorkspaceType } from "@/lib/workspace/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      totpCode?: string;
      next?: string;
    };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await compare(body.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Second factor when the account has 2FA enabled.
    if (user.totpEnabled) {
      const code = (body.totpCode || "").trim();
      if (!code) {
        return NextResponse.json(
          { error: "Two-factor code required", requires2fa: true },
          { status: 401 },
        );
      }
      const secret = decryptSecret(user.totpSecretEnc);
      const codeOk = secret ? verifyTotp(code, secret) : false;
      const backupCodes = Array.isArray(user.totpBackupCodes) ? user.totpBackupCodes : [];
      const remaining = codeOk ? null : consumeBackupCode(code, backupCodes);
      if (!codeOk && remaining === null) {
        return NextResponse.json(
          { error: "Invalid two-factor code", requires2fa: true },
          { status: 401 },
        );
      }
      if (remaining !== null) {
        // Consume the used backup code so it can't be reused.
        await prisma.user.update({
          where: { id: user.id },
          data: { totpBackupCodes: remaining },
        });
      }
    }

    if (!(await userHasAnyWorkspaceAccess(user.id))) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 403 });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (email === CERT_BROWSER_EMAIL) {
      const certMembership =
        memberships.find(
          (m: { workspace: { type: string } }) => m.workspace.type !== "PERSONAL",
        ) ?? memberships[0];
      const workspaceId = certMembership.workspaceId;
      await grantProductEntitlement(workspaceId, "voice", "trial");
      await grantProductEntitlement(workspaceId, "sms", "trial");
      await grantProductEntitlement(workspaceId, "numbers", "trial");
      await grantWorkspaceProductFeature(workspaceId, "mctb", "active");
      await grantWorkspaceProductFeature(workspaceId, "visual_voicemail", "active");
      await grantWorkspaceProductFeature(workspaceId, "ai_notetaker", "active");
    }

    const access = await getUserProductAccess(user.id);
    const pathProduct = preferredProductFromPath(body.next || "");
    const preferredProduct: ProductKey =
      pathProduct ??
      (access.hasNumbers && !access.hasVoice
        ? "numbers"
        : access.hasVoice
          ? "voice"
          : access.hasNumbers
            ? "numbers"
            : "voice");

    const resolvedWorkspace = await resolveAuthenticatedWorkspace(user.id, preferredProduct);
    const membership =
      memberships.find(
        (m: { workspaceId: string }) => m.workspaceId === resolvedWorkspace.workspaceId,
      ) ??
      (await prisma.membership.findFirst({
        where: { userId: user.id, workspaceId: resolvedWorkspace.workspaceId },
        include: { workspace: true },
      })) ??
      memberships[0];
    if (!membership) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 403 });
    }

    const workspaceType: WorkspaceType =
      membership.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS";

    const redirectPath = resolvePostLoginPath(access, { nextPath: body.next });

    // If the user verified a mobile number on the sign-in page, attach it.
    const store = await cookies();
    const verifiedPhone = readVerifiedPhone(store.get(PHONE_VERIFIED_COOKIE)?.value);
    if (verifiedPhone && user.phone !== verifiedPhone) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { phone: verifiedPhone, phoneVerifiedAt: new Date() },
        });
      } catch (err) {
        console.warn("[auth/login] phone attach skipped", err);
      }
    }

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };

    const res = NextResponse.json({
      ok: true,
      workspaceId: membership.workspaceId,
      workspace: membership.workspace.name,
      redirectPath,
    });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    applyWorkspaceCookies(res, membership.workspaceId, workspaceType);
    applyProductAccessCookie(res, access);
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 },
    );
  }
}
