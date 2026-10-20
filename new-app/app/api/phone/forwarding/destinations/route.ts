import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  createForwardingDestination,
  listForwardingDestinations,
} from "@/lib/server/phone/routing/store";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listForwardingDestinations(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const row = await createForwardingDestination(workspaceId, {
      name: String(body.name || "Destination"),
      phoneE164: String(body.phoneE164 || body.phone || ""),
      enabled: body.enabled !== false,
      screeningEnabled: Boolean(body.screeningEnabled),
      press1Required: Boolean(body.press1Required),
      privateAnnouncement:
        typeof body.privateAnnouncement === "string" ? body.privateAnnouncement : null,
      ringTimeoutSec:
        typeof body.ringTimeoutSec === "number" ? body.ringTimeoutSec : undefined,
      callerIdPolicy: typeof body.callerIdPolicy === "string" ? body.callerIdPolicy : undefined,
      hostedE164: typeof body.hostedE164 === "string" ? body.hostedE164 : undefined,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
