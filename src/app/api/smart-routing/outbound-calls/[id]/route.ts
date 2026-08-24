import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getBusinessCallbackStatus } from "@/lib/smart-routing/business-callback-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const status = await getBusinessCallbackStatus(id, auth.workspaceId);
    if (!status) return jsonError(new Error("Outbound call not found"), 404);
    return NextResponse.json({ data: status });
  } catch (err) {
    return jsonError(err);
  }
}
