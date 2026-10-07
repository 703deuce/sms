import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api-auth";
import { loadAppointmentRemindersOverview } from "@/lib/appointment-reminders/load-ar-overview";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadAppointmentRemindersOverview(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
