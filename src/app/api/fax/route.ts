import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listFaxTransmissions } from "@/lib/fax/fax-service";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const direction = url.searchParams.get("direction") || undefined;
    const folder = url.searchParams.get("folder") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const limit = Number(url.searchParams.get("limit") || 50);

    const data = await listFaxTransmissions(auth.workspaceId, {
      direction,
      folder,
      status,
      limit,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
