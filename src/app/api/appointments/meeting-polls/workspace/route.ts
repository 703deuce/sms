import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { buildMeetingPollsWorkspace } from "@/lib/appointments/meeting-polls/workspace";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await buildMeetingPollsWorkspace(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
