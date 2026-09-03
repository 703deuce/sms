import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  findAppointmentByPublicToken,
  updatePlatformAppointmentStatus,
} from "@/lib/appointments";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { confirmToken?: string })?.confirmToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const updated = await updatePlatformAppointmentStatus(row.workspaceId, row.id, "confirmed", {
      type: "confirmed",
      label: "Customer confirmed appointment",
    });
    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { confirmToken?: string })?.confirmToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        id: row.id,
        serviceName: row.serviceName,
        startsAt: row.startsAt,
        status: row.status,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
