import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { bulkUpdateAppointmentTypes, reorderAppointmentTypes } from "@/lib/appointments/booking-platform";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      updates?: Array<{ id: string; config?: object; displayOrder?: number }>;
      orderedIds?: string[];
      typeIds?: string[];
      visibility?: string;
      managed?: boolean;
      bookingApprovalRequired?: boolean;
    };

    if (body.typeIds?.length && (body.visibility || body.managed !== undefined || body.bookingApprovalRequired !== undefined)) {
      const configPatch: Record<string, unknown> = {};
      if (body.visibility) configPatch.visibility = body.visibility;
      if (body.managed !== undefined) configPatch.managed = body.managed;
      if (body.bookingApprovalRequired !== undefined) {
        configPatch.bookingApproval = { required: body.bookingApprovalRequired };
      }
      const updates = body.typeIds.map((id) => ({ id, config: configPatch }));
      const data = await bulkUpdateAppointmentTypes(auth.workspaceId, updates);
      return NextResponse.json({ data });
    }

    if (body.action === "reorder" && body.orderedIds?.length) {
      const data = await reorderAppointmentTypes(auth.workspaceId, body.orderedIds);
      return NextResponse.json({ data });
    }

    if (body.updates?.length) {
      const data = await bulkUpdateAppointmentTypes(auth.workspaceId, body.updates);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "updates or orderedIds required" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
