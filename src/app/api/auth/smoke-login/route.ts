/**
 * Issue a session for an existing user without changing their password.
 * Bootstrap-header only — for live acceptance / agent phone deploy.
 *
 * Auth: x-smoke-bootstrap: transovo-smoke-bootstrap-b56f-aug2026
 * Body: { "email": "user@example.com", "workspaceId"?: "..." }
 */
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { getPrisma } from "@/lib/db";

const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";

export async function POST(request: Request) {
  if (request.headers.get(BOOTSTRAP_HEADER) !== BOOTSTRAP_VALUE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      workspaceId?: string;
    };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true, slug: true, type: true } } },
    });
    if (!memberships.length) {
      return NextResponse.json({ error: "User has no workspace" }, { status: 404 });
    }

    let membership = memberships[0] as (typeof memberships)[number];
    if (body.workspaceId) {
      const match = memberships.find(
        (m: (typeof memberships)[number]) => m.workspaceId === body.workspaceId,
      );
      if (!match) {
        return NextResponse.json(
          { error: "Not a member of that workspace" },
          { status: 403 },
        );
      }
      membership = match;
    }

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name || user.email,
      isAdmin: Boolean(user.isPlatformAdmin),
    };

    const res = NextResponse.json({
      ok: true,
      email: user.email,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      workspaces: memberships.map((m: (typeof memberships)[number]) => ({
        id: m.workspaceId,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    });

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
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
