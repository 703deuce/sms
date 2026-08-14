import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { generatePromptAudio } from "@/lib/smart-routing/media-service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      text?: string;
      voiceId?: string;
      speed?: number;
    };
    if (!body.text?.trim() || !body.voiceId?.trim()) {
      return NextResponse.json({ error: "text and voiceId required" }, { status: 400 });
    }
    const asset = await generatePromptAudio({
      workspaceId: auth.workspaceId,
      name: body.name?.trim() || "Greeting",
      text: body.text.trim(),
      voiceId: body.voiceId.trim(),
      speed: body.speed,
    });
    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
