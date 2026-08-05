import { NextResponse } from "next/server";
import { handleTexmlStatusCallback } from "@/lib/voice/telnyx/texml-status-callback";

/** TeXML application status_callback — call progress for TeXML-direct inbound. */
export async function POST(request: Request) {
  try {
    return await handleTexmlStatusCallback(request);
  } catch (err) {
    console.error("[telnyx/voice/texml-status]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TeXML status failed" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "telnyx-texml-status" });
}
