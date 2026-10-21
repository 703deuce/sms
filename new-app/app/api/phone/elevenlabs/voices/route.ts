import { NextResponse } from "next/server";
import { PHONE_ELEVENLABS_VOICES } from "@/lib/voice/elevenlabs-voice-catalog";

export async function GET() {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  return NextResponse.json({
    data: {
      configured,
      voices: PHONE_ELEVENLABS_VOICES,
    },
  });
}
