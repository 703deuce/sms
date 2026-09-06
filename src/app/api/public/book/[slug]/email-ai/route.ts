import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { handleEmailAiBooking } from "@/lib/appointments/ai-booking-orchestrator";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json()) as {
      email?: string;
      subject?: string;
      message?: string;
      body?: string;
      contactId?: string;
      conversationId?: string;
    };
    const email = String(body.email || "").trim();
    const subject = String(body.subject || "").trim();
    const text = String(body.message || body.body || "").trim();
    if (!email || !text) {
      return NextResponse.json({ error: "email and message required" }, { status: 400 });
    }

    const result = await handleEmailAiBooking(
      workspace.id,
      email,
      subject,
      text,
      body.contactId,
    );
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
