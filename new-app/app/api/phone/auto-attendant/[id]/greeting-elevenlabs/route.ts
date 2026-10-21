import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { saveAutoAttendantMenu } from "@/lib/server/phone/routing/store";
import { synthesizeElevenLabsMp3 } from "@/lib/server/voice/elevenlabs-tts";
import { toPublicAssetUrl } from "@/lib/server/public-url";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
    if (!voiceId) throw new Error("voiceId is required");

    const audio = await synthesizeElevenLabsMp3({ text, voiceId });
    const dir = path.join(process.cwd(), "public", "cf-greeting", workspaceId);
    await mkdir(dir, { recursive: true });
    const safeName = `${id}-el-${Date.now()}.mp3`;
    const diskPath = path.join(dir, safeName);
    await writeFile(diskPath, audio);
    const relativeUrl = `/cf-greeting/${workspaceId}/${safeName}`;
    const publicUrl = toPublicAssetUrl(relativeUrl);

    const menu = await saveAutoAttendantMenu(workspaceId, id, {
      greetingMode: "audio",
      greetingAudioUrl: publicUrl,
      greetingText: text.trim() || null,
      voice: voiceId,
    });
    return NextResponse.json({
      data: { url: publicUrl, relativeUrl, menu },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
