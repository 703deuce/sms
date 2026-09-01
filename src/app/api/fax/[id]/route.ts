import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getFaxTransmission } from "@/lib/fax/fax-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const data = await getFaxTransmission(auth.workspaceId, id);
    if (!data) return jsonError(new Error("Fax not found"), 404);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
