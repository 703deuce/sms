import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  appendApprovedAnswerToKnowledgeBase,
  listVoiceKnowledgeGaps,
  updateVoiceKnowledgeGapStatus,
} from "@/lib/voice-v3/knowledge-gaps/owner-service";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "view_transcripts");

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const rows = await listVoiceKnowledgeGaps(auth.workspaceId, { status });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "edit_agent");

    const body = (await request.json()) as {
      id?: string;
      status?: "OPEN" | "DISMISSED" | "RESOLVED";
      answerText?: string;
      knowledgeBaseId?: string;
    };
    const id = String(body.id || "").trim();
    const status = body.status;
    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    if (status === "RESOLVED" && body.answerText?.trim() && body.knowledgeBaseId?.trim()) {
      const gaps = await listVoiceKnowledgeGaps(auth.workspaceId);
      const gap = gaps.find((g) => g.id === id);
      if (!gap) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await appendApprovedAnswerToKnowledgeBase({
        workspaceId: auth.workspaceId,
        knowledgeBaseId: body.knowledgeBaseId.trim(),
        question: gap.displayQuestion,
        answerText: body.answerText.trim(),
      });
    }

    await updateVoiceKnowledgeGapStatus({
      workspaceId: auth.workspaceId,
      gapId: id,
      status,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
