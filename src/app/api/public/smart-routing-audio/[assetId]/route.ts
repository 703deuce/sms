import { NextResponse } from "next/server";
import { readSmartRoutingAudioBytes } from "@/lib/smart-routing/media-service";

type Ctx = { params: Promise<{ assetId: string }> };

/**
 * Telnyx gather_using_audio / playback_start — no session cookie.
 * Serves MP3 from disk or regenerates from ElevenLabs metadata when missing.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { assetId } = await ctx.params;
  const result = await readSmartRoutingAudioBytes(assetId);
  if (!result) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }
  return new NextResponse(result.bytes, {
    status: 200,
    headers: {
      "content-type": result.mimeType || "audio/mpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}
