import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import {
  loadTransovoVideoConfig,
  saveTransovoVideoConfig,
} from "@/lib/transovo-video/settings";
import type { TransovoVideoPlatformConfig } from "@/lib/transovo-video/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);
    const config = await loadTransovoVideoConfig(auth.workspaceId);
    return NextResponse.json({ data: config });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);
    const body = (await request.json().catch(() => ({}))) as Partial<TransovoVideoPlatformConfig>;
    const config = await saveTransovoVideoConfig(auth.workspaceId, body);
    return NextResponse.json({ data: config });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
