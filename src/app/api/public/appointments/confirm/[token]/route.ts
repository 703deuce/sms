import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  buildPublicAppointmentCustomerPreview,
  findAppointmentByPublicToken,
  updatePlatformAppointmentStatus,
} from "@/lib/appointments";
import { resolveManageLinkFromMetadata } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await findAppointmentByPublicToken(token);
    if (!row || (row.metadata as { confirmToken?: string })?.confirmToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    const updated = await updatePlatformAppointmentStatus(
      row.workspaceId,
      row.id,
      "confirmed",
      {
        type: "confirmed",
        label: "Customer confirmed appointment",
      },
      "customer",
      { confirmationSource: "web" },
    );
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
    const meta = (row.metadata || {}) as AppointmentMetadata;
    return NextResponse.json({
      data: {
        ...buildPublicAppointmentCustomerPreview(row),
        manageLink: resolveManageLinkFromMetadata(meta, meta.rescheduleToken),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
