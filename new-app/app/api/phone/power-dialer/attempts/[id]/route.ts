import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { saveAttemptOutcome } from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const data = await saveAttemptOutcome(workspaceId, id, {
      disposition: String(body.disposition || ""),
      notes: typeof body.notes === "string" ? body.notes : undefined,
      callbackAt: typeof body.callbackAt === "string" ? body.callbackAt : null,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
