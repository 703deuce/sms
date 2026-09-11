import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { sendBookingEmailOtp, verifyBookingEmailOtp } from "@/lib/appointments/booking-approval";
import { createClientPortalSession } from "@/lib/appointments/service-booking";
import { getPrisma } from "@/lib/db";
import { clientPortalSetCookieHeader } from "@/lib/appointments/client-portal/cookie";

type Params = { params: Promise<{ slug: string }> };

const NEUTRAL_SENT = "If we find an account for that email, we'll send a sign-in code.";

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const body = (await request.json()) as { action?: string; email?: string; code?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    if (body.action !== "verify") {
      const contact = await getPrisma().contact.findFirst({
        where: { workspaceId: workspace.id, email },
        select: { id: true },
      });
      if (contact) {
        await sendBookingEmailOtp(workspace.id, email);
      }
      return NextResponse.json({ data: { message: NEUTRAL_SENT } });
    }

    const code = String(body.code || "").trim();
    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const verified = await verifyBookingEmailOtp(workspace.id, email, code);
    if (!verified) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const contact = await getPrisma().contact.findFirst({
      where: { workspaceId: workspace.id, email },
    });
    if (!contact) {
      return NextResponse.json({ data: { message: NEUTRAL_SENT } });
    }

    const session = await createClientPortalSession(workspace.id, contact.id);
    const res = NextResponse.json({
      data: {
        ok: true,
        workspaceSlug: workspace.slug,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
    res.headers.set("Set-Cookie", clientPortalSetCookieHeader(session.rawToken));
    return res;
  } catch (err) {
    return jsonError(err, 400);
  }
}
