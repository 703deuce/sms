import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      contactId?: string;
      phone?: string;
      email?: string;
      bookingUrl?: string;
      timezone?: string;
      linkedin?: string;
    };

    if (body.action === "send_booking_link") {
      const url = body.bookingUrl || "";
      const message = `Book an appointment with us: ${url}`;
      if (body.phone) {
        const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
        await sendAppointmentSms({ workspaceId: auth.workspaceId, to: body.phone, body: message });
      } else if (body.email) {
        const { sendTransactionalEmail } = await import("@/lib/email/brevo");
        await sendTransactionalEmail({
          to: body.email,
          subject: "Book an appointment",
          htmlContent: `<p><a href="${url}">Click here to book</a></p>`,
          textContent: message,
        });
      }
      return NextResponse.json({ data: { sent: true } });
    }

    if (body.contactId && (body.timezone || body.linkedin)) {
      const prisma = getPrisma();
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, workspaceId: auth.workspaceId },
      });
      if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      const customFields = (contact.customFields || {}) as Record<string, unknown>;
      if (body.linkedin) customFields.linkedin = body.linkedin;
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          timezone: body.timezone || contact.timezone,
          customFields: customFields as object,
        },
      });
      return NextResponse.json({ data: { updated: true } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
