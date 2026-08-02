/**
 * Generate a flow draft from natural language without an existing agent
 * (used on the create-agent screen).
 */
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { generateVoiceFlowFromNaturalLanguage } from "@/lib/voice/flow/generate-from-nl";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { prompt?: string };
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    const generated = await generateVoiceFlowFromNaturalLanguage(prompt);
    return NextResponse.json({
      data: generated.bundle,
      templateId: generated.templateId,
      mode: generated.mode,
      provider: generated.provider,
      model: generated.model,
      summary: generated.summary,
      issues: generated.issues,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
