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
import { finalizeMctbAgentSmsReply } from "@/lib/mctb/sms-channel";
import { loadMctbInboxConversationThread } from "@/lib/mctb/semantic-conversation-context";
import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";

export type MctbSimpleSmsAgentInput = {
  workspaceId: string;
  conversationId: string;
  customerPhone: string;
  body: string;
  timezone?: string;
};

const SIMPLE_SMS_SYSTEM = `You are the business's helpful SMS assistant continuing a missed-call text conversation.

Use ONLY the BUSINESS KNOWLEDGE block for business-specific facts (hours, services, location, policies). Do not invent information.

Read the conversation thread so you know what was already said. Do not repeat the opener verbatim.

Your job:
1. Answer the customer's latest question in one or two short sentences.
2. If knowledge does not cover it, say the team will follow up — do not guess.
3. Plain text only. Target about 160 characters (one SMS segment). Hard maximum 280 characters.
4. Do NOT include any URLs or links in your reply (booking links are added by the system only when appropriate).
5. Do NOT address the customer by name unless they clearly introduced themselves in this thread.
6. Do NOT add STOP, HELP, opt-out, or compliance footer text (the first business text already included that).
7. No markdown, no sign-off names, no "Anthony" or other names from metadata.

BOOKING: Only set include_booking_link true when BOOKING is enabled and the customer wants to schedule. Never paste a URL yourself.

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
    maxTokens: 220,
  });

  if (!llm?.data?.reply?.trim()) {
    llm = await mctbSemanticStructuredJson<{ reply: string; include_booking_link?: boolean }>({
      system: SIMPLE_SMS_SYSTEM,
      user: JSON.stringify(userPayload),
      temperature: 0.2,
      maxTokens: 220,
      provider: "openai",
    });
  }

  const llmReply = llm?.data?.reply?.trim();
  if (!llmReply) {
    console.warn("[mctb/simple-sms-agent] semantic LLM returned no reply");
    return { handled: false };
  }

  let reply = llmReply;

  const appendBooking = bookingOn && bookingUrl && llm?.data?.include_booking_link;
  if (appendBooking && bookingUrl && !reply.includes(bookingUrl)) {
    reply = `${reply} Book: ${bookingUrl}`;
  }

  reply = finalizeMctbAgentSmsReply(reply, {
    allowedUrl: appendBooking ? bookingUrl : null,
  });
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
    timezone: input.timezone || bookingConfig.timezone || null,
    booking: bookingOn && bookingUrl ? { enabled: true, url: bookingUrl } : { enabled: false },
  });

  const { llmProvider: _p, llmModel: _m, ...rest } = result;
  return rest;
}
