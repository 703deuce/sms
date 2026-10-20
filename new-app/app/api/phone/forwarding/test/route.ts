import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getPrisma } from "@/lib/server/db";
import { resolveForwardingDestinationRow } from "@/lib/server/phone/routing/resolve-destination";

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const destinationId = typeof body.destinationId === "string" ? body.destinationId : null;
    const confirm = body.confirm === true;
    if (!destinationId) throw new Error("destinationId is required");
    const dest = await getPrisma().forwardingDestination.findFirst({
      where: { id: destinationId, workspaceId },
    });
    if (!dest) throw new Error("Destination not found");
    const resolved = await resolveForwardingDestinationRow(dest, {});
    if (!confirm) {
      return NextResponse.json({
        data: {
          ready: true,
          message:
            "Destination validated. Set confirm=true to mark as tested (live test calls are not auto-dialed from this endpoint).",
          destination: { id: dest.id, name: dest.name, phoneE164: resolved.dialE164 },
        },
      });
    }
    await getPrisma().forwardingDestination.update({
      where: { id: dest.id },
      data: { lastTestedAt: new Date() },
    });
    return NextResponse.json({ data: { tested: true, testedAt: new Date().toISOString() } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
