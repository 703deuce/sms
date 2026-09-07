import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { getRecallHubSummary, listRecallActivity } from "@/lib/appointments/recalls-hub";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "activity") {
      const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
      const activity = await listRecallActivity(auth.workspaceId, limit);
      return NextResponse.json({ data: activity });
    }

    const [summary, activity] = await Promise.all([
      getRecallHubSummary(auth.workspaceId),
      listRecallActivity(auth.workspaceId, 50),
    ]);

    return NextResponse.json({
      data: {
        ...summary,
        activity,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
