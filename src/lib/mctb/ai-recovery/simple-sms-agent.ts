import "server-only";

import {
  loadMctbAiBookingConfig,
  resolveFallbackBookingUrl,
} from "@/lib/mctb/ai-booking/config";
import type { MctbAiBookingInboundResult } from "@/lib/mctb/ai-booking/conversation-runtime-types";
import {
  applyConversationTruncationPolicy,
  type MctbConversationTurn,
} from "@/lib/mctb/conversation-thread";
import { loadMctbLeadRecoveryKnowledgeBundle } from "@/lib/mctb/lead-recovery/knowledge-prompt";
import { isCarrierProtocolOptOutMessage } from "@/lib/mctb/lead-recovery/protocol-intent";
import { finalizeMctbOutboundSms } from "@/lib/mctb/sms-channel";
import { loadMctbInboxConversationThread } from "@/lib/mctb/semantic-conversation-context";
import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";

export type MctbSimpleSmsAgentInput = {
  workspaceId: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string | null;
  body: string;
  timezone?: string;
};

const SIMPLE_SMS_SYSTEM = `You are the business's helpful SMS assistant continuing a missed-call text conversation.

Use ONLY the BUSINESS KNOWLEDGE block for business-specific facts (hours, services, location, policies). Do not invent information.

Read the full SMS thread, including the first outbound recovery message from the business, so you know what was already said.

Your job:
1. Understand what the customer is asking or needs right now.
2. Answer their question directly when the knowledge block supports it.
3. If you cannot answer from the knowledge block, say briefly that the team will follow up with that detail — do not guess.
4. Converse naturally. Do not run a rigid intake form or ask for name/address unless the customer is clearly trying to schedule service and volunteered details.
5. When the customer seems done or you have helped them, reassure them the team will get back to them soon.
6. Plain text only, under 320 characters, no markdown.

BOOKING: Only follow booking instructions when a BOOKING section is present in the user payload. Never mention booking links if booking is not enabled.

Return JSON: { "reply": string, "include_booking_link": boolean }`;

function formatThreadForPrompt(thread: MctbConversationTurn[]): string {
  return thread
    .map((t) => `${t.role === "customer" ? "Customer" : "Business"}: ${t.text}`)
    .join("\n");
}

function resolveThread(input: {
  inbox: MctbConversationTurn[];
  latestCustomerMessage: string;
}): MctbConversationTurn[] {
  let base = [...input.inbox];
  const trimmed = input.latestCustomerMessage.trim();
  const last = base.at(-1);
  if (!(last?.role === "customer" && last.text === trimmed)) {
    base = [...base, { role: "customer", text: trimmed }];
  }
  const { conversation } = applyConversationTruncationPolicy(base);
  return conversation;
}

function bookingEnabledForPrompt(bookingConfig: Awaited<ReturnType<typeof loadMctbAiBookingConfig>>): boolean {
  return Boolean(
    bookingConfig.enabled &&
      !bookingConfig.upgradeRequired &&
      (bookingConfig.fallbackBookingLinkId || bookingConfig.fulfillmentMode === "calendar"),
  );
}

/**
 * Single-prompt MCTB SMS agent — business knowledge + full thread, no policy/intent/RAG pipeline.
 */
export async function handleMctbSimpleSmsAgentInbound(
  input: MctbSimpleSmsAgentInput,
): Promise<MctbAiBookingInboundResult> {
  if (isCarrierProtocolOptOutMessage(input.body)) {
    return { handled: false };
  }

  const [knowledge, inbox, bookingConfig] = await Promise.all([
    loadMctbLeadRecoveryKnowledgeBundle(input.workspaceId, {
      includeCollectPrompts: false,
    }),
    loadMctbInboxConversationThread(input.conversationId),
    loadMctbAiBookingConfig(input.workspaceId),
  ]);

  const thread = resolveThread({
    inbox,
    latestCustomerMessage: input.body,
  });

  const bookingOn = bookingEnabledForPrompt(bookingConfig);
  let bookingUrl: string | null = null;
  if (bookingOn) {
    bookingUrl = await resolveFallbackBookingUrl(input.workspaceId, bookingConfig);
  }

  const userPayload: Record<string, unknown> = {
    customer_name: input.customerName?.trim() || null,
    timezone: input.timezone || bookingConfig.timezone || null,
    business_knowledge: knowledge.runtime_prompt_block,
    conversation_thread: formatThreadForPrompt(thread),
  };

  if (bookingOn && bookingUrl) {
    userPayload.booking = {
      enabled: true,
      instructions:
        "If the customer wants to schedule or book, set include_booking_link to true and mention they can pick a time at the link.",
      booking_link_url: bookingUrl,
    };
  } else {
    userPayload.booking = { enabled: false };
  }

  const llm = await mctbSemanticStructuredJson<{ reply: string; include_booking_link?: boolean }>({
    system: SIMPLE_SMS_SYSTEM,
    user: JSON.stringify(userPayload),
    temperature: 0.2,
    maxTokens: 400,
  });

  let reply =
    llm?.data?.reply?.trim() ||
    "Thanks for texting us back — someone from our team will follow up with you shortly.";

  if (bookingOn && bookingUrl && llm?.data?.include_booking_link) {
    if (!reply.includes(bookingUrl)) {
      reply = `${reply} Book here: ${bookingUrl}`;
    }
  }

  reply = finalizeMctbOutboundSms(reply);
  if (!reply.trim()) {
    return { handled: false };
  }

  return {
    handled: true,
    reply,
    action: llm?.data?.include_booking_link ? "simple_sms_booking_link" : "simple_sms_reply",
  };
}
