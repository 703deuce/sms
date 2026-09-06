import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { extractSamlEmail, verifySamlResponse } from "@/lib/auth/saml-verify";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { applyProductAccessCookie } from "@/lib/products/session";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { getPrisma } from "@/lib/db";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const saml = (platform as { samlSso?: { enabled?: boolean; certificate?: string } }).samlSso;
    if (!saml?.enabled) {
      return NextResponse.json({ error: "SAML not enabled" }, { status: 404 });
    }

    const form = await request.formData();
    const samlResponse = String(form.get("SAMLResponse") || "");
    if (!samlResponse) {
      return NextResponse.json({ error: "SAMLResponse required" }, { status: 400 });
    }

    const verified = verifySamlResponse(samlResponse, saml.certificate || "");
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error || "Invalid SAML response" }, { status: 401 });
    }

    const email = extractSamlEmail(verified.xml);
    if (!email) {
      return NextResponse.json({ error: "Could not extract user email from SAML assertion" }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: "User not provisioned in workspace" }, { status: 403 });
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, workspaceId },
      include: { workspace: { select: { id: true, type: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "User is not a member of this workspace" }, { status: 403 });
    }

    const access = await getUserProductAccess(user.id);
    const session = {
      userId: user.id,
      email: user.email,
      name: user.name || user.email,
      isAdmin: Boolean(user.isPlatformAdmin),
    };

    const relayState = String(form.get("RelayState") || "/appointments/overview");
    const res = NextResponse.redirect(publicRedirectUrl(relayState, request), 302);
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
  } catch (err) {
    console.error("[saml-acs]", err);
    return NextResponse.json({ error: "SAML authentication failed" }, { status: 500 });
  }
}
