import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { buildClientDetail } from "@/lib/appointments/clients/clients-workspace";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { clientId } = await params;
    const data = await buildClientDetail(auth.workspaceId, clientId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const { clientId } = await params;
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      timezone?: string;
      status?: string;
      addNote?: string;
      customFields?: Record<string, unknown>;
    };

    const prisma = getPrisma();
    const existing = await prisma.contact.findFirst({ where: { id: clientId, workspaceId: auth.workspaceId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (body.firstName !== undefined) patch.firstName = body.firstName;
    if (body.lastName !== undefined) patch.lastName = body.lastName;
    if (body.email !== undefined) patch.email = body.email?.trim() || null;
    if (body.timezone !== undefined) patch.timezone = body.timezone;
    if (body.status !== undefined) patch.status = String(body.status).toUpperCase();
    if (body.phone?.trim()) {
      const normalized = normalizeE164(body.phone.trim());
      const conflict = await prisma.contact.findFirst({
        where: { workspaceId: auth.workspaceId, phone: normalized, NOT: { id: clientId } },
      });
      if (conflict) return NextResponse.json({ error: "Phone already in use" }, { status: 409 });
      patch.phone = normalized;
    }

    const customFields = { ...((existing.customFields || {}) as Record<string, unknown>) };
    if (body.customFields) Object.assign(customFields, body.customFields);
    if (body.addNote?.trim()) {
      const notes = (customFields.appointmentsClientNotes || []) as Array<{
        id: string;
        body: string;
        at: string;
        author?: string;
      }>;
      notes.unshift({
        id: `note_${randomBytes(6).toString("hex")}`,
        body: body.addNote.trim(),
        at: new Date().toISOString(),
        author: auth.session.email,
      });
      customFields.appointmentsClientNotes = notes.slice(0, 200);
    }
    patch.customFields = customFields;

    await prisma.contact.update({ where: { id: clientId }, data: patch });
    const data = await buildClientDetail(auth.workspaceId, clientId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
