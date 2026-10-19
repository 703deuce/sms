import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getWebRtcLoginToken } from "@/lib/server/phone/webrtc-token";

export async function GET() {
  try {
    const data = await getWebRtcLoginToken();
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
