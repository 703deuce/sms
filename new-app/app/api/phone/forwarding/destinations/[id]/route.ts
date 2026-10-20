import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  deleteForwardingDestination,
  updateForwardingDestination,
} from "@/lib/server/phone/routing/store";
import { getPrisma } from "@/lib/server/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await updateForwardingDestination(workspaceId, id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.phoneE164 === "string" ? { phoneE164: body.phoneE164 } : {}),
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.screeningEnabled === "boolean"
        ? { screeningEnabled: body.screeningEnabled }
        : {}),
      ...(typeof body.press1Required === "boolean" ? { press1Required: body.press1Required } : {}),
      ...(body.privateAnnouncement === null || typeof body.privateAnnouncement === "string"
        ? { privateAnnouncement: body.privateAnnouncement as string | null }
        : {}),
      ...(typeof body.ringTimeoutSec === "number" ? { ringTimeoutSec: body.ringTimeoutSec } : {}),
      ...(typeof body.callerIdPolicy === "string" ? { callerIdPolicy: body.callerIdPolicy } : {}),
    });
    if (body.lastTestedAt === "now") {
      await getPrisma().forwardingDestination.update({
        where: { id },
        data: { lastTestedAt: new Date() },
      });
    }
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    await deleteForwardingDestination(workspaceId, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
