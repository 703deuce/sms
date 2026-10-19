import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { detectNumberProductBindings } from "@/lib/server/telephony/bindings";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const workspaceId = await resolveWorkspaceId();
    const bindings = await detectNumberProductBindings({
      workspaceId,
      phoneNumberId: id,
    });
    return NextResponse.json({ data: { phoneNumberId: id, bindings } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
