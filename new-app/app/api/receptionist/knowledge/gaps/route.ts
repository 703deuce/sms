import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import {
  listKnowledgeGaps,
  resolveKnowledgeGap,
} from "@/lib/server/receptionist/knowledge-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const rows = await listKnowledgeGaps(workspaceId);
    const data = rows.map((g) => {
      let lastCallId: string | null = null;
      try {
        const ids = g.sourceCallIds as unknown;
        if (Array.isArray(ids) && ids.length) lastCallId = String(ids[ids.length - 1]);
      } catch {
        /* ignore */
      }
      return {
        id: g.id,
        question: g.displayQuestion,
        count: g.timesAsked,
        impact: g.timesAsked >= 5 ? "high" : g.timesAsked >= 2 ? "medium" : "low",
        lastCallId,
      };
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { gapId: string; answer: string };
    await resolveKnowledgeGap(workspaceId, body.gapId, body.answer);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
