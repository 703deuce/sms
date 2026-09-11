import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { testResourceAvailability } from "@/lib/appointments/resources/resources-workspace";

type Params = { params: Promise<{ resourceId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { resourceId } = await params;
    const body = (await request.json()) as {
      startsAt?: string;
      endsAt?: string;
      serviceId?: string;
    };
    if (!body.startsAt || !body.endsAt) {
      return NextResponse.json({ error: "startsAt and endsAt are required" }, { status: 400 });
    }
    const data = await testResourceAvailability(auth.workspaceId, {
      resourceId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      serviceId: body.serviceId,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
