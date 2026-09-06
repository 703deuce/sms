import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import {
  sendBookingEmailOtp,
  verifyBookingEmailOtp,
} from "@/lib/appointments/booking-approval";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json()) as {
      action?: string;
      email?: string;
      code?: string;
    };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    if (body.action === "verify") {
      const code = String(body.code || "").trim();
      if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
      const ok = await verifyBookingEmailOtp(workspace.id, email, code);
      if (!ok) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
      return NextResponse.json({ data: { verified: true } });
    }

    const result = await sendBookingEmailOtp(workspace.id, email);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 500);
  }
}
