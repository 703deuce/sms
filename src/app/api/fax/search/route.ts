import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { searchFaxTransmissions } from "@/lib/fax/fax-service";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const data = await searchFaxTransmissions(auth.workspaceId, q);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
