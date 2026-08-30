import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isUiStudioEnabled } from "@/lib/ui-agent/dev-gate";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  if (!isUiStudioEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { sessionId } = await context.params;
  const sessionPath = join(process.cwd(), ".ui-agent/sessions", sessionId, "session.json");
  if (!existsSync(sessionPath)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const handoffPath = join(process.cwd(), ".ui-agent/sessions", sessionId, "HANDOFF.json");
  const handoff = existsSync(handoffPath) ? JSON.parse(readFileSync(handoffPath, "utf8")) : null;

  return NextResponse.json({
    session,
    handoff,
    previewUrl: `/api/dev/ui-studio/preview/${sessionId}`,
  });
}
