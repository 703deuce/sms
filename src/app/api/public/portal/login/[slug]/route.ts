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

    const body = (await request.json()) as { action?: string; email?: string; code?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    if (body.action !== "verify") {
      const result = await sendBookingEmailOtp(workspace.id, email);
      return NextResponse.json({ data: result });
    }

    const code = String(body.code || "").trim();
    if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
    const verified = await verifyBookingEmailOtp(workspace.id, email, code);
    if (!verified) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    const prisma = getPrisma();
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: workspace.id, email },
    });
    if (!contact) {
      return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    }

    const session = await createClientPortalSession(workspace.id, contact.id);
    return NextResponse.json({
      data: {
        portalToken: session.rawToken,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
