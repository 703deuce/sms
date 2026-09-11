import { NextResponse } from "next/server";
import type { DbRow } from "@/lib/db";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  createPlatformAppointment,
  listAppointmentTypes,
} from "@/lib/appointments";
import { buildAppointmentsDirectory } from "@/lib/appointments/list/appointments-list-workspace";
import { assertEventTypeAccess } from "@/lib/appointments/org-permissions";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const q = searchParams.get("q") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const tab = searchParams.get("tab") || undefined;
    const staffIds = searchParams.get("staffIds");
    const { rows, summary } = await buildAppointmentsDirectory(auth.workspaceId, {
      tab,
      status,
      q,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      staffIds: staffIds ? staffIds.split(",").filter(Boolean) : undefined,
      locationId: searchParams.get("locationId") || undefined,
      resourceId: searchParams.get("resourceId") || undefined,
      domainType: searchParams.get("domainType") || undefined,
      payment: searchParams.get("payment") || undefined,
      attention: searchParams.get("attention") === "1",
      take: searchParams.get("take") ? Number(searchParams.get("take")) : undefined,
    });
    return NextResponse.json({ data: rows, summary });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.book");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    if (body.serviceId) {
      const types = await listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true });
      const type = types.find((t: DbRow) => t.id === String(body.serviceId));
      if (type?.config) {
        await assertEventTypeAccess(
          auth.workspaceId,
          auth.session.userId,
          auth.session.email,
          type.config,
          "book",
        );
      }
    }
    const result = await createPlatformAppointment(auth.workspaceId, {
      serviceId: body.serviceId ? String(body.serviceId) : undefined,
      serviceName: String(body.serviceName || ""),
      startsAt: String(body.startsAt || ""),
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
      phone: String(body.phone || ""),
      email: body.email ? String(body.email) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      smsConsent: body.smsConsent === true,
      source: "admin",
      status: body.status ? String(body.status) : "scheduled",
      skipSms: body.skipSms === true,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
