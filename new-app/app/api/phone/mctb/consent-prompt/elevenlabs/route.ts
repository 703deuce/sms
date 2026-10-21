import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { saveMctbConsentPrompt } from "@/lib/server/mctb/consent-prompt-store";
import { MCTB_UI_ENABLED } from "@/lib/products/mctb-ui";
import { synthesizeElevenLabsMp3 } from "@/lib/server/voice/elevenlabs-tts";
import { toPublicAssetUrl } from "@/lib/server/public-url";

export async function POST(request: Request) {
  if (!MCTB_UI_ENABLED) {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
    if (!text) throw new Error("text is required");
    if (!voiceId) throw new Error("voiceId is required");

    const audio = await synthesizeElevenLabsMp3({ text, voiceId });
    const dir = path.join(process.cwd(), "public", "mctb-consent", workspaceId);
    await mkdir(dir, { recursive: true });
    const safeName = `el-${Date.now()}.mp3`;
    const diskPath = path.join(dir, safeName);
    await writeFile(diskPath, audio);
    const relativeUrl = `/mctb-consent/${workspaceId}/${safeName}`;
    const publicUrl = toPublicAssetUrl(relativeUrl);

    const prompt = await saveMctbConsentPrompt(workspaceId, {
      source: "elevenlabs",
      scriptText: text,
      voiceId,
      audioUrl: publicUrl,
    });
    return NextResponse.json({ data: { url: publicUrl, prompt } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
