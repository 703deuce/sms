import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getOpenAiApiKey } from "@/lib/ai/openai";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    return NextResponse.json({ data: { enabled: Boolean(getOpenAiApiKey()) } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
