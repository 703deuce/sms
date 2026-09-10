import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getExternalBusyIntervals } from "@/lib/appointments/scheduling-domain";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    }

    const intervals = await getExternalBusyIntervals(
      auth.workspaceId,
      new Date(from),
      new Date(to),
    );

    return NextResponse.json({
      data: intervals.map((b) => ({
        id: `busy:${b.start.toISOString()}`,
        startsAt: b.start.toISOString(),
        endsAt: b.end.toISOString(),
        label: "Busy",
        source: "External calendar",
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
