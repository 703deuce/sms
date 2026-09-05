import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { loadNotetakerConfig, saveNotetakerConfig } from "@/lib/meeting-assistant/settings";
import type { NotetakerPlatformConfig } from "@/lib/meeting-assistant/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const data = await loadNotetakerConfig(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const body = (await request.json()) as Partial<NotetakerPlatformConfig>;
    const data = await saveNotetakerConfig(auth.workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
