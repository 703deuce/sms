import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  diagnoseSlotAvailability,
  explainSlotUnavailability,
} from "@/lib/appointments/slot-diagnostics";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get("serviceName");
    const startsAt = searchParams.get("startsAt");
    if (!serviceName || !startsAt) {
      return NextResponse.json({ error: "serviceName and startsAt required" }, { status: 400 });
    }
    const staffId = searchParams.get("staffId") || undefined;
    const explain = searchParams.get("explain") === "true";
    if (explain) {
      const text = await explainSlotUnavailability(auth.workspaceId, serviceName, startsAt);
      return NextResponse.json({ data: { explanation: text } });
    }
    const diagnostic = await diagnoseSlotAvailability(auth.workspaceId, {
      serviceName,
      startsAt,
      staffId,
    });
    return NextResponse.json({ data: diagnostic });
  } catch (err) {
    return jsonError(err, 500);
  }
}
