import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { getMeetingRecordingAccessUrl } from "@/lib/meeting-assistant/processing";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const { id } = await context.params;
    const access = await getMeetingRecordingAccessUrl(auth.workspaceId, id);
    if (!access.url) {
      return NextResponse.json({ error: "Recording not available" }, { status: 404 });
    }
    return NextResponse.json({ data: access });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
