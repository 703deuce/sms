import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getCalendlyCapabilities } from "@/lib/integrations/adapters/calendly-capabilities";

export async function GET() {
  try {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const caps = await getCalendlyCapabilities(auth.workspaceId);
  return NextResponse.json({
    data: {
      connected: caps.connected,
      planBlocked: caps.planBlocked,
      directBookingPreflightOk: caps.directBookingPreflightOk,
      canCreateBooking: caps.canCreateBooking,
      health: caps.health,
      notes: caps.notes,
    },
  });
  } catch (err) {
    return jsonError(err, 500);
  }
}
