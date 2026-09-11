import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getAvailability } from "@/lib/appointments";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId") || undefined;
    // The engine keys availability off the booking type, so an id is passed
    // through when the caller has one: it is what makes duration, phases and
    // resource requirements apply.
    const data = await getAvailability(auth.workspaceId, {
      serviceId,
      serviceName: searchParams.get("serviceName") || undefined,
      daysAhead: Number(searchParams.get("daysAhead") || 14),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
