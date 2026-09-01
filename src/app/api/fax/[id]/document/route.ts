import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getFaxDocumentSignedUrl } from "@/lib/fax/fax-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const url = await getFaxDocumentSignedUrl(auth.workspaceId, id);
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return jsonError(err, 404);
  }
}
