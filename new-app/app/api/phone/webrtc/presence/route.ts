import { NextResponse } from "next/server";
import { markWebRtcRegistered } from "@/lib/server/phone/webrtc-presence";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request) {
  const workspaceId = resolveWorkspaceId();
  let body: { registered?: boolean } = {};
  try {
    body = (await request.json()) as { registered?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await markWebRtcRegistered(workspaceId, body.registered !== false);
  return NextResponse.json({ ok: true });
}
