import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { buildResourceDetail } from "@/lib/appointments/resources/resources-workspace";
import { syncResourceServiceAssignments } from "@/lib/appointments/resources/resource-service-sync";
import {
  maxConcurrentResourceUsage,
  upsertSchedulingResource,
} from "@/lib/appointments/service-booking/resources";

type Params = { params: Promise<{ resourceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { resourceId } = await params;
    const data = await buildResourceDetail(auth.workspaceId, resourceId);
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
    const { resourceId } = await params;
    const body = (await request.json()) as {
      name?: string;
      quantity?: number;
      description?: string | null;
      category?: string;
      locationIds?: string[];
      eligibleTypeIds?: string[];
      active?: boolean;
      deactivate?: boolean;
      forceDeactivate?: boolean;
      forceCapacity?: boolean;
    };

    const existing = await buildResourceDetail(auth.workspaceId, resourceId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.deactivate) {
      if (existing.futureReservationCount > 0 && !body.forceDeactivate) {
        return NextResponse.json(
          {
            error: `${existing.resource.name} has ${existing.futureReservationCount} future reservations.`,
            code: "future_reservations",
            futureReservationCount: existing.futureReservationCount,
          },
          { status: 409 },
        );
      }
      body.active = false;
    }

    if (body.quantity != null && body.quantity < existing.resource.quantity && !body.forceCapacity) {
      const now = new Date();
      const horizon = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      const peak = await maxConcurrentResourceUsage(auth.workspaceId, resourceId, now, horizon);
      if (peak > body.quantity) {
        return NextResponse.json(
          {
            error: `Capacity ${body.quantity} is below peak concurrent usage (${peak}) in the next 180 days.`,
            code: "capacity_conflict",
            peakUsage: peak,
          },
          { status: 409 },
        );
      }
    }

    const row = await upsertSchedulingResource(auth.workspaceId, {
      id: resourceId,
      name: body.name ?? existing.resource.name,
      quantity: body.quantity ?? existing.resource.quantity,
      description: body.description ?? existing.resource.description ?? undefined,
      category: body.category ?? existing.resource.category,
      locationIds: body.locationIds ?? existing.resource.locationIds,
      eligibleTypeIds: body.eligibleTypeIds ?? existing.resource.eligibleTypeIds,
      active: body.active ?? existing.resource.active,
    });

    if (body.eligibleTypeIds) {
      await syncResourceServiceAssignments(auth.workspaceId, resourceId, body.eligibleTypeIds);
    }

    const data = await buildResourceDetail(auth.workspaceId, row.id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
