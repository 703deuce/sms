import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { bundleReferencePreview } from "../../../../../../../scripts/ui-agent/preview";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const generatedDir = join(process.cwd(), ".ui-agent/generated", sessionId);
  if (!existsSync(join(generatedDir, "page.tsx"))) {
    return new NextResponse("Generated session not found", { status: 404 });
  }

  try {
    const htmlPath = bundleReferencePreview(sessionId);
    const html = readFileSync(htmlPath, "utf8");
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Preview bundle failed: ${message}`, { status: 500 });
  }
}
