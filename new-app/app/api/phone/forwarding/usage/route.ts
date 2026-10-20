import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getForwardingConfig } from "@/lib/server/phone/routing/store";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { usage } = await getForwardingConfig(workspaceId);
    return NextResponse.json({
      data: usage ?? {
        forwardedCalls: 0,
        answeredCalls: 0,
        missedCalls: 0,
        forwardedMinutes: 0,
        bridgedMinutes: 0,
        ivrMinutes: 0,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
