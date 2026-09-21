import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { searchBusinessesForWorkspace } from "@/lib/voice-v3/business-import/service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();
    if (!query || query.length < 2) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }
    const results = await searchBusinessesForWorkspace(query);
    return NextResponse.json({ data: results });
  } catch (err) {
    return jsonError(err, 500);
  }
}
