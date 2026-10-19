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
    const data = await listKnowledgeGaps(workspaceId);
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
