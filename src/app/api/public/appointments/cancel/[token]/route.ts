import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  cancelPlatformAppointment,
  findAppointmentByPublicToken,
} from "@/lib/appointments";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { cancelToken?: string })?.cancelToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const updated = await cancelPlatformAppointment(row.workspaceId, row.id);
    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { cancelToken?: string })?.cancelToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    return NextResponse.json({
      data: buildPublicAppointmentCustomerPreview(row),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
