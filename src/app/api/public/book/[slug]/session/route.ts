import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { checkoutBookingSession } from "@/lib/appointments/booking-session";
import { resolveWorkspaceBySlug } from "@/lib/appointments";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) {
      return NextResponse.json({ error: "At least one booking line is required" }, { status: 400 });
    }
    const phone = String(body.phone || "").trim();
    if (!phone) return NextResponse.json({ error: "Phone is required" }, { status: 400 });

    const result = await checkoutBookingSession({
      workspaceId: workspace.id,
      phone,
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
      email: body.email ? String(body.email) : undefined,
      smsConsent: body.smsConsent === true,
      bookingAnswers: body.bookingAnswers as Record<string, string> | undefined,
      lines,
      payment: body.payment,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return jsonError(err, 500);
  }
}
