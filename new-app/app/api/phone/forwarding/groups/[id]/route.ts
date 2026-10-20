import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { deleteForwardingGroup, upsertForwardingGroup } from "@/lib/server/phone/routing/store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const strategy =
      body.strategy === "simultaneous"
        ? "simultaneous"
        : body.strategy === "sequential"
          ? "sequential"
          : undefined;
    const group = await upsertForwardingGroup(workspaceId, {
      id,
      name: typeof body.name === "string" ? body.name : "Ring group",
      strategy: strategy || "sequential",
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      memberDestinationIds: Array.isArray(body.memberDestinationIds)
        ? body.memberDestinationIds.map(String)
        : undefined,
    });
    return NextResponse.json({ data: group });
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
    await deleteForwardingGroup(workspaceId, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
