import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadAppointmentRemindersAnalytics } from "@/lib/appointment-reminders/load-ar-analytics";

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const toRaw = searchParams.get("to");
  const fromRaw = searchParams.get("from");
  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 30 * 24 * 60 * 60_000);
  return { from, to };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const range = parseRange(searchParams);
    const data = await loadAppointmentRemindersAnalytics(auth.workspaceId, range);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
