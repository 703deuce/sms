import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { verifyBookingEmailOtp, sendBookingEmailOtp } from "@/lib/appointments/booking-approval";
import { createClientPortalSession } from "@/lib/appointments/service-booking";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const prisma = getPrisma();
    const body = (await request.json()) as { action?: string; email?: string; code?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    if (body.action !== "verify") {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId: workspace.id, email },
        select: { id: true },
      });
      if (contact) await sendBookingEmailOtp(workspace.id, email);
      return NextResponse.json({
        data: { message: "If we find an account for that email, we'll send a sign-in code." },
      });
    }

    const code = String(body.code || "").trim();
    if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
    const verified = await verifyBookingEmailOtp(workspace.id, email, code);
    if (!verified) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { workspaceId: workspace.id, email },
    });
    if (!contact) {
      return NextResponse.json({
        data: { message: "If we find an account for that email, we'll send a sign-in code." },
      });
    }

    const session = await createClientPortalSession(workspace.id, contact.id);
    const { clientPortalSetCookieHeader } = await import("@/lib/appointments/client-portal/cookie");
    const res = NextResponse.json({
      data: {
        ok: true,
        expiresAt: session.expiresAt.toISOString(),
        redirect: "/client",
      },
    });
    res.headers.set("Set-Cookie", clientPortalSetCookieHeader(session.rawToken));
    return res;
  } catch (err) {
    return jsonError(err, 400);
  }
}
