import { NextResponse } from "next/server";
import { getMediaBackendHealthReport } from "@/lib/voice/media-backend";

export const dynamic = "force-dynamic";

/** Internal health snapshot for LiveKit media backends (no secrets). */
export async function GET() {
  try {
    const report = await getMediaBackendHealthReport();
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
