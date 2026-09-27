import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadMctbOverviewEnrichment } from "@/lib/mctb/overview";

/** Tier-2 overview data (AI recovery, inbound handling) — must not block dashboard first paint. */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadMctbOverviewEnrichment(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
