import { defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";
import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

const PAYMENTS_INSTRUCTIONS = `## Payment collection
- When the caller needs to pay an invoice, deposit, or balance, use the payment_link tool when it is available on this agent.
- Never invent card numbers, processor confirmations, or claim a payment succeeded until a tool or staff confirms it.
- If payment_link is not available, collect callback details and create a task for billing staff — do not process card data verbally.`;

/**
 * Prefer an existing workspace VoiceTool named/keyed like payment_link (webhook pattern).
 * Otherwise configure advanced.paymentsEnabled with a placeholder webhook URL shape.
 */
async function resolvePaymentToolConfig(workspaceId: string) {
  const prisma = getPrisma();
  const tools = await prisma.voiceTool.findMany({
    where: {
      workspaceId,
      status: "active",
    },
    select: { id: true, name: true, toolType: true, config: true },
    take: 100,
  });

  const match = tools.find((t: { id: string; name: string; toolType: string; config: unknown }) => {
    const name = (t.name || "").toLowerCase();
    const type = (t.toolType || "").toLowerCase();
    const cfg = (t.config || {}) as Record<string, unknown>;
    const key = String(cfg.key || cfg.toolKey || "").toLowerCase();
    return (
      name.includes("payment") ||
      key === "payment_link" ||
      type.includes("payment") ||
      Boolean(cfg.paymentLink || cfg.payment_link)
    );
  });

  if (match) {
    return {
      toolId: match.id,
      webhookUrl:
        typeof (match.config as { webhookUrl?: string } | null)?.webhookUrl === "string"
          ? (match.config as { webhookUrl: string }).webhookUrl
          : `${getAppBaseUrl()}/api/payments/links`,
      source: "workspace_tool" as const,
    };
  }

  return {
    toolId: null as string | null,
    webhookUrl: `${getAppBaseUrl()}/api/payments/links`,
    source: "placeholder" as const,
  };
}

const hook = defineCapabilityHook({
  id: "payments",
  status: "platform_ready",
  notes:
    "paymentsEnabled + payment webhook URL config; instructions to use payment_link when available",
  onActivate: async (ctx) => {
    const payment = await resolvePaymentToolConfig(ctx.workspaceId);

    await applyCapabilityDraftPatch(ctx, "payments", {
      instructionMarker: "## Payment collection",
      appendInstructions: PAYMENTS_INSTRUCTIONS,
      enableTools: ["send_sms", "create_task", "take_structured_message"],
      advanced: {
        paymentsEnabled: true,
        payments: {
          enabled: true,
          webhookUrl: payment.webhookUrl,
          paymentLinkToolId: payment.toolId,
          source: payment.source,
          /** Instruct runtime / sync to prefer payment_link when registered. */
          usePaymentLinkToolWhenAvailable: true,
        },
      },
      messaging: {
        paymentLinks: true,
      },
    });

    if (payment.toolId) {
      const prisma = getPrisma();
      const refreshed = await prisma.voiceAgent.findFirst({
        where: { id: ctx.agentId, workspaceId: ctx.workspaceId },
        select: { draftConfig: true },
      });
      const d = (refreshed?.draftConfig || {}) as Record<string, unknown>;
      const ids = Array.isArray(d.toolIds) ? [...(d.toolIds as string[])] : [];
      if (!ids.includes(payment.toolId)) {
        await prisma.voiceAgent.update({
          where: { id: ctx.agentId },
          data: {
            draftConfig: {
              ...d,
              toolIds: [...ids, payment.toolId],
            },
          },
        });
      }
    }
  },
});

export const registerCapability = hook.registerCapability;
export const runActivateHooks = hook.runActivateHooks;
