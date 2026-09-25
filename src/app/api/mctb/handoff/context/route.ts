import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { loadMctbHandoffConfig } from "@/lib/mctb/handoff/config";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  const prisma = getPrisma();
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    select: { id: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const automation = await prisma.mctbConversationAutomationState.findFirst({
    where: { conversationId, workspaceId },
  });
  const snapshot = await prisma.mctbLeadSnapshot.findFirst({
    where: { workspaceId, conversationId },
    orderBy: { createdAt: "desc" },
  });
  const config = await loadMctbHandoffConfig(workspaceId);

  return NextResponse.json({
    data: {
      state: automation?.state ?? null,
      followUpStatus: automation?.followUpStatus ?? null,
      responseMode: automation?.responseMode ?? config.responseMode,
      capturedFields: (automation?.capturedFieldsJson || {}) as Record<string, unknown>,
      latestSnapshot: snapshot
        ? {
            summaryText: snapshot.summaryText,
            customerFacts: snapshot.customerFactsJson as Record<string, unknown>,
            aiDerived: snapshot.aiDerivedJson as Record<string, unknown>,
          }
        : null,
    },
  });
}
