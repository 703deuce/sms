import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { translateText } from "@/lib/ai/translate";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { text?: string; targetLang?: string };
    const text = String(body.text || "");
    const targetLang = String(body.targetLang || "es");
    const data = await translateText(text, targetLang);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
