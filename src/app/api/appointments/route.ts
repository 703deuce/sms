import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createPlatformAppointment,
  listAppointments,
} from "@/lib/appointments";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const q = searchParams.get("q") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const data = await listAppointments(auth.workspaceId, {
      status,
      q,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
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
