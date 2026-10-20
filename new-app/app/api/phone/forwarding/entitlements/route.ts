import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getForwardingEntitlements } from "@/lib/server/phone/routing/forwarding-entitlements";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getForwardingEntitlements(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
