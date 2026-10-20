import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getForwardingConfig, upsertForwardingGroup } from "@/lib/server/phone/routing/store";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { groups } = await getForwardingConfig(workspaceId);
    return NextResponse.json({ data: groups });
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
    const strategy = body.strategy === "simultaneous" ? "simultaneous" : "sequential";
    const group = await upsertForwardingGroup(workspaceId, {
      name: String(body.name || "Ring group"),
      strategy,
      enabled: body.enabled !== false,
      memberDestinationIds: Array.isArray(body.memberDestinationIds)
        ? body.memberDestinationIds.map(String)
        : undefined,
    });
    return NextResponse.json({ data: group });
  } catch (err) {
    return jsonError(err, 400);
  }
}
