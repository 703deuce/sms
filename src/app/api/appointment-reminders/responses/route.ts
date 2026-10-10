import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  loadArResponsesFeed,
  type ArResponseFeedView,
} from "@/lib/appointment-reminders/load-ar-responses-feed";

function parseView(raw: string | null): ArResponseFeedView {
  if (raw === "needs_attention" || raw === "held" || raw === "all") return raw;
  return "all";
}

export async function GET(req: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const view = parseView(url.searchParams.get("view"));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || "100")));

    const rows = await loadArResponsesFeed(auth.workspaceId, view, limit);
    return NextResponse.json({ data: { view, rows } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
