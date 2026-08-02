import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { ingestInsightWebhook } from "@/lib/voice/platform/ai-platform";

/**
 * Telnyx conversation insight group webhook receiver.
 * Configure the insight group's webhook_url to this path.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const url = new URL(request.url);
    const workspaceHint =
      url.searchParams.get("workspaceId") ||
      (typeof payload.workspace_id === "string" ? payload.workspace_id : null);

    // Best-effort workspace resolution via conversation id or assistant metadata.
    let workspaceId = workspaceHint;
    if (!workspaceId) {
      const conversationId = String(
        payload.conversation_id ||
          (payload.data as Record<string, unknown> | undefined)?.conversation_id ||
          "",
      );
      if (conversationId) {
        const conv = await getPrisma().voiceAiConversation.findFirst({
          where: { telnyxConversationId: conversationId },
        });
        workspaceId = conv?.workspaceId || null;
      }
    }

    const result = await ingestInsightWebhook({
      workspaceId,
      payload,
    });

    await getPrisma().providerWebhookEvent.create({
      data: {
        workspaceId: workspaceId || undefined,
        provider: "telnyx",
        eventType: "ai.insight_webhook",
        providerEventId: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        payload: payload as object,
        status: "processed",
        processedAt: new Date(),
      },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insight webhook failed" },
      { status: 500 },
    );
  }
}
