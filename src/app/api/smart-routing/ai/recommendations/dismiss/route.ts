import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { dismissRecommendation } from "@/lib/smart-routing/ai/recommendations";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return jsonError(new Error("id required"), 400);
    await dismissRecommendation(auth.workspaceId, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err);
  }
}
