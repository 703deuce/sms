import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { handleUnifiedAiBooking } from "@/lib/appointments/ai-booking-orchestrator";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.book");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      channel?: "sms" | "email";
      message?: string;
      contactId?: string;
      phone?: string;
      email?: string;
      conversationId?: string;
    };
    if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });
    if (body.channel === "voice") {
      return NextResponse.json(
        { error: "Voice AI booking is not supported. Use Telnyx press-1 voice reminders for outbound calls." },
        { status: 400 },
      );
    }
    const result = await handleUnifiedAiBooking({
      workspaceId: auth.workspaceId,
      channel: body.channel || "email",
      message: body.message,
      contactId: body.contactId,
      phone: body.phone,
      email: body.email,
      conversationId: body.conversationId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
