import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getMessagingRuntimeSettings,
  upsertMessagingRuntimeSettings,
  type BusinessHoursJson,
} from "@/lib/messaging/messaging-settings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getMessagingRuntimeSettings(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      businessHoursJson?: BusinessHoursJson | null;
      timezone?: string;
      awayMessage?: string | null;
      awayEnabled?: boolean;
      awayAlways?: boolean;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
      reviewLinkUrl?: string | null;
    };

    const patch: Record<string, unknown> = {};
    if (body.businessHoursJson !== undefined) patch.businessHoursJson = body.businessHoursJson;
    if (body.timezone) patch.timezone = body.timezone;
    if (body.awayMessage !== undefined) patch.awayMessage = body.awayMessage;
    if (body.awayEnabled !== undefined) patch.awayEnabled = body.awayEnabled;
    if (body.awayAlways !== undefined) patch.awayAlways = body.awayAlways;
    if (body.quietHoursStart !== undefined) patch.quietHoursStart = body.quietHoursStart;
    if (body.quietHoursEnd !== undefined) patch.quietHoursEnd = body.quietHoursEnd;
    if (body.reviewLinkUrl !== undefined) patch.reviewLinkUrl = body.reviewLinkUrl?.trim() || null;

    const data = await upsertMessagingRuntimeSettings(auth.workspaceId, patch);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
