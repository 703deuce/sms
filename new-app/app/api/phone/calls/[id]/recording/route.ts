import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import {
  loadHumanCallForRecordingPlayback,
  resolveHumanCallRecordingForPlayback,
} from "@/lib/server/phone/recording-playback";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const call = await loadHumanCallForRecordingPlayback(workspaceId, id);
    if (!call) {
      return NextResponse.json({ error: "No recording" }, { status: 404 });
    }
    const url = await resolveHumanCallRecordingForPlayback(call);
    if (!url) {
      return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
    }
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
