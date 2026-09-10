import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";

type Params = { params: Promise<{ token: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });
    }

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    const prisma = getPrisma();
    const updated = await prisma.contact.update({
      where: { id: resolved.session.contactId },
      data: {
        ...(body.firstName !== undefined ? { firstName: String(body.firstName).trim() } : {}),
        ...(body.lastName !== undefined ? { lastName: String(body.lastName).trim() } : {}),
        ...(body.phone !== undefined ? { phone: String(body.phone).trim() } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    return NextResponse.json({ data: { contact: updated } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
