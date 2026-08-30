import { NextResponse } from "next/server";
import { readActiveVoicemailGreetingBytes } from "@/lib/phone/voicemail-active-greeting";

type Ctx = { params: Promise<{ workspaceId: string; phoneNumberId: string }> };

/**
 * Stable voicemail greeting URL for TeXML &lt;Play&gt; — no session, no Postgres.
 * Content is provisioned at configuration time; this route only reads disk/cache pointer.
 * Fails open to platform default audio on any miss.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { workspaceId, phoneNumberId } = await ctx.params;
  const result = await readActiveVoicemailGreetingBytes(workspaceId, phoneNumberId);
  if (!result.bytes.length) {
    return NextResponse.json({ error: "Greeting not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "content-type": result.mimeType || "audio/mpeg",
      "cache-control":
        result.source === "platform"
          ? "public, max-age=86400"
          : "public, max-age=300, must-revalidate",
      "x-voicemail-greeting-source": result.source,
    },
  });
}
