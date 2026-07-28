import { NextResponse } from "next/server";
import { processDueJobs } from "@/lib/jobs/job-handlers";

/**
 * Minute cron entrypoint:
 *   curl -X POST "$APP_URL/api/jobs/process" -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (secret && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // In production require CRON_SECRET
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  try {
    const result = await processDueJobs(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
