import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Public download of Assistants-compatible Telnyx NaturalHD + Ultra voices.
 * No auth — same filter as /telnyx-agent-voices static files.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const base = path.join(process.cwd(), "public", "telnyx-agent-voices");

  const files: Record<string, { file: string; contentType: string; download: string }> = {
    json: {
      file: "telnyx-agent-voices.json",
      contentType: "application/json; charset=utf-8",
      download: "telnyx-agent-voices.json",
    },
    csv: {
      file: "telnyx-agent-voices.csv",
      contentType: "text/csv; charset=utf-8",
      download: "telnyx-agent-voices.csv",
    },
    md: {
      file: "telnyx-agent-voices.md",
      contentType: "text/markdown; charset=utf-8",
      download: "telnyx-agent-voices.md",
    },
  };

  const spec = files[format] || files.json;
  try {
    const body = await readFile(path.join(base, spec.file));
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": spec.contentType,
        "content-disposition": `attachment; filename="${spec.download}"`,
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Voice catalog file not found on server" },
      { status: 404 },
    );
  }
}
