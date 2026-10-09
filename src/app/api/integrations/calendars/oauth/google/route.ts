import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import { getGoogleOAuthStartUrl } from "@/lib/calendar/oauth";
import { isCalendarProviderAllowedForAppointmentReminders } from "@/lib/appointment-reminders/calendar-provider-policy";
import type { CalendarConfig } from "@/lib/calendar/providers";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const connectionId = new URL(request.url).searchParams.get("connectionId") || "";
    const returnTo = new URL(request.url).searchParams.get("returnTo") || undefined;
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }
    const conn = await getWorkspaceCalendarConnection(auth.workspaceId, connectionId);
    if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = (conn.config || {}) as CalendarConfig & { productContext?: string };
    if (
      config.productContext === "appointment_reminders" &&
      !isCalendarProviderAllowedForAppointmentReminders("google")
    ) {
      return NextResponse.json(
        {
          error:
            "Google Calendar is not available for Appointment Reminders during Microsoft 365 launch.",
        },
        { status: 403 },
      );
    }
    const url = getGoogleOAuthStartUrl(connectionId, auth.workspaceId, returnTo);
    return NextResponse.redirect(url);
  } catch (err) {
    return jsonError(err, 400);
  }
}
