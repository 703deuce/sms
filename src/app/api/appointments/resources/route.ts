import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { upsertSchedulingResource } from "@/lib/appointments/service-booking/resources";
import { syncResourceServiceAssignments } from "@/lib/appointments/resources/resource-service-sync";
import { buildResourceDetail } from "@/lib/appointments/resources/resources-workspace";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      quantity?: number;
      description?: string;
      category?: string;
      locationIds?: string[];
      eligibleTypeIds?: string[];
      active?: boolean;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const row = await upsertSchedulingResource(auth.workspaceId, {
      name: body.name,
      quantity: body.quantity,
      description: body.description,
      category: body.category,
      locationIds: body.locationIds,
      eligibleTypeIds: body.eligibleTypeIds,
      active: body.active,
    });
    if (body.eligibleTypeIds?.length) {
      await syncResourceServiceAssignments(auth.workspaceId, row.id, body.eligibleTypeIds);
    }
    const data = await buildResourceDetail(auth.workspaceId, row.id);
    return NextResponse.json({ data, resourceId: row.id }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
