import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { findDuplicateClientCandidates } from "@/lib/appointments/clients/client-identity";
import { buildClientDetail } from "@/lib/appointments/clients/clients-workspace";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      forceCreate?: boolean;
    };

    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const duplicates = await findDuplicateClientCandidates(auth.workspaceId, {
      email: body.email,
      phone: body.phone,
    });
    if (duplicates.length && !body.forceCreate) {
      return NextResponse.json({ error: "Possible duplicate", code: "duplicate", duplicates }, { status: 409 });
    }

    const phone = normalizeE164(body.phone.trim());
    const prisma = getPrisma();
    const row = await prisma.contact.create({
      data: {
        workspaceId: auth.workspaceId,
        firstName: body.firstName?.trim() || "Client",
        lastName: body.lastName?.trim() || "",
        email: body.email?.trim() || null,
        phone,
        status: "SUBSCRIBED",
        consentSource: "appointments_admin",
        consentDate: new Date(),
      },
    });

    const data = await buildClientDetail(auth.workspaceId, row.id);
    return NextResponse.json({ data, clientId: row.id }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
