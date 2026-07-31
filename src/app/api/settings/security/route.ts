import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json({ error: "currentPassword and newPassword required" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: auth.session.userId } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Password not set for this account" }, { status: 400 });
    }

    const ok = await compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const passwordHash = await hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: user.id,
        event: "password_changed",
        detail: "User changed password",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
