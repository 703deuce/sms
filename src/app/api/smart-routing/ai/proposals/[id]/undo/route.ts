import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { undoAiRoutingChange } from "@/lib/smart-routing/ai/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const result = await undoAiRoutingChange(
      auth.workspaceId,
      id,
      auth.session.userId,
    );
    if (!result.ok) return jsonError(new Error(result.error ?? "Undo failed"), 400);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err);
  }
}
