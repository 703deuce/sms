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

export type MctbSimpleSmsAgentTurnContext = {
  customerMessage: string;
  thread: MctbConversationTurn[];
  businessKnowledgeBlock: string;
  customerName?: string | null;
  timezone?: string | null;
  booking?: { enabled: boolean; url?: string | null };
};

/** Core agent turn — used in production and dialogue smoke tests (inject thread + knowledge). */
export async function runMctbSimpleSmsAgentTurn(
  ctx: MctbSimpleSmsAgentTurnContext,
): Promise<
  MctbAiBookingInboundResult & {
    llmProvider?: string;
    llmModel?: string;
    llmInvoked?: boolean;
  }
> {
  const thread = resolveThread({
    inbox: ctx.thread,
    latestCustomerMessage: ctx.customerMessage,
  });

  const bookingOn = ctx.booking?.enabled === true;
  const bookingUrl = ctx.booking?.url?.trim() || null;

  const userPayload: Record<string, unknown> = {
    customer_name: ctx.customerName?.trim() || null,
    timezone: ctx.timezone || null,
    business_knowledge: ctx.businessKnowledgeBlock,
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

  let llm = await mctbSemanticStructuredJson<{ reply: string; include_booking_link?: boolean }>({
    system: SIMPLE_SMS_SYSTEM,
    user: JSON.stringify(userPayload),
    temperature: 0.2,
    maxTokens: 400,
  });

  if (!llm?.data?.reply?.trim()) {
    llm = await mctbSemanticStructuredJson<{ reply: string; include_booking_link?: boolean }>({
      system: SIMPLE_SMS_SYSTEM,
      user: JSON.stringify(userPayload),
      temperature: 0.2,
      maxTokens: 400,
      provider: "openai",
    });
  }

  const llmReply = llm?.data?.reply?.trim();
  if (!llmReply) {
    console.warn("[mctb/simple-sms-agent] semantic LLM returned no reply");
    return { handled: false };
  }

  let reply = llmReply;

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
    llmProvider: llm?.provider,
    llmModel: llm?.model,
    llmInvoked: Boolean(llm?.data?.reply?.trim()),
  };
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

  const bookingOn = bookingEnabledForPrompt(bookingConfig);
  let bookingUrl: string | null = null;
  if (bookingOn) {
    bookingUrl = await resolveFallbackBookingUrl(input.workspaceId, bookingConfig);
  }

  const result = await runMctbSimpleSmsAgentTurn({
    customerMessage: input.body,
    thread: inbox,
    businessKnowledgeBlock: knowledge.runtime_prompt_block,
    customerName: input.customerName,
    timezone: input.timezone || bookingConfig.timezone || null,
    booking: bookingOn && bookingUrl ? { enabled: true, url: bookingUrl } : { enabled: false },
  });

  const { llmProvider: _p, llmModel: _m, ...rest } = result;
  return rest;
}
