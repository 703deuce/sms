import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadLinkClickReport } from "@/lib/links/click-events";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const days = Number(new URL(request.url).searchParams.get("days") || 30);
    const data = await loadLinkClickReport(auth.workspaceId, days);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
