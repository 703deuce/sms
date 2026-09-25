import { getPrisma } from "@/lib/db";
import { shouldBlockAutomation } from "@/lib/mctb/handoff/automation-state";
import {
  isStaleAutonomousAiOutbound,
  resolveAutomationHandoffWatermarkMs,
} from "@/lib/mctb/messaging/automation-handoff-watermark";

export type MctbAiOutboundHandoffCheck =
  | { allow: true }
  | { allow: false; reason: "mctb_ai_handoff_superseded" | "mctb_automation_human_active" };

export async function validateMctbAutonomousAiOutboundBeforeSend(input: {
  conversationId: string;
  enqueuedAtIso: string;
  outboundSource?: string | null;
}): Promise<MctbAiOutboundHandoffCheck> {
  if (input.outboundSource && input.outboundSource !== "lead_recovery_ai") {
    return { allow: true };
  }

  const prisma = getPrisma();
  const row = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId: input.conversationId },
    select: {
      state: true,
      humanTakenOverAt: true,
      humanTakenOverByUserId: true,
      metadataJson: true,
    },
  });

  if (!row) return { allow: true };

  if (shouldBlockAutomation(row.state) || row.humanTakenOverByUserId) {
    return { allow: false, reason: "mctb_automation_human_active" };
  }

  const watermark = resolveAutomationHandoffWatermarkMs({
    humanTakenOverAt: row.humanTakenOverAt,
    metadataJson: row.metadataJson,
  });

  if (isStaleAutonomousAiOutbound({ enqueuedAtIso: input.enqueuedAtIso, handoffWatermarkMs: watermark })) {
    return { allow: false, reason: "mctb_ai_handoff_superseded" };
  }

  return { allow: true };
}
