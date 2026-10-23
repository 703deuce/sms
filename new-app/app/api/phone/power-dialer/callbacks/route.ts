import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listPowerDialerCallbacks } from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const tab = new URL(request.url).searchParams.get("tab") || "all";
    const allowed = ["due_today", "upcoming", "overdue", "completed", "all"] as const;
    const normalized = allowed.includes(tab as (typeof allowed)[number])
      ? (tab as (typeof allowed)[number])
      : "all";
    const data = await listPowerDialerCallbacks(workspaceId, normalized);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
