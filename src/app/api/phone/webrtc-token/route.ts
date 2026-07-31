import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getWebRtcLoginToken } from "@/lib/phone/webrtc-token";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const token = await getWebRtcLoginToken();
    return NextResponse.json({ data: token });
  } catch (err) {
    return jsonError(err, 500);
  }
}
