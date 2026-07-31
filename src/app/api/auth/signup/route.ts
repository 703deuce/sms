import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      businessName?: string;
    };
    if (!body.email || !body.password || !body.name) {
      return NextResponse.json({ error: "Name, email, and password required" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const passwordHash = await hash(body.password, 10);
    const businessName = (body.businessName || `${body.name}'s Workspace`).trim();
    let slug = slugify(businessName);
    const slugTaken = await prisma.workspace.findUnique({ where: { slug } });
    if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash,
        isPlatformAdmin: false,
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: businessName,
        slug,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
        messagingRegistration: {
          create: {},
        },
      },
    });

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };

    const res = NextResponse.json({ ok: true, workspace: workspace.name, workspaceId: workspace.id });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    res.cookies.set(WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    console.error("[auth/signup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup failed" },
      { status: 500 },
    );
  }
}
