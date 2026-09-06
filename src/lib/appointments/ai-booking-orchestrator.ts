/**
 * Unified AI booking orchestration — single entry for voice, SMS, and email channels.
 * All channels delegate to the same deterministic resolver + availability + booking engine.
 */
import "server-only";

import { handleAppointmentAIRequest } from "@/lib/appointments/ai-scheduling/service";
import type { AppointmentAiChannel, AppointmentAiResult } from "@/lib/appointments/ai-scheduling/schema";

export type UnifiedBookingChannel = "voice" | "sms" | "email";

export type UnifiedBookingInput = {
  workspaceId: string;
  channel: UnifiedBookingChannel;
  message: string;
  contactId?: string | null;
  phone?: string | null;
  email?: string | null;
  conversationId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function handleUnifiedAiBooking(
  input: UnifiedBookingInput,
): Promise<AppointmentAiResult> {
  const channel: AppointmentAiChannel =
    input.channel === "voice"
      ? "voice"
      : input.channel === "email"
        ? "email"
        : input.conversationId
          ? "conversation"
          : "sms";

  return handleAppointmentAIRequest({
    workspaceId: input.workspaceId,
    channel,
    message: input.message,
    customerId: input.contactId || undefined,
    conversationId:
      input.conversationId ||
      `${input.channel}:${input.contactId || input.phone || input.email || "anon"}`,
    requestId: input.requestId,
    conversationHistory: input.conversationHistory,
  });
}

export async function handleSmsAiBooking(
  workspaceId: string,
  phone: string,
  message: string,
  contactId?: string | null,
) {
  return handleUnifiedAiBooking({
    workspaceId,
    channel: "sms",
    message,
    phone,
    contactId,
  });
}

export async function handleVoiceAiBooking(
  workspaceId: string,
  phone: string,
  transcript: string,
  contactId?: string | null,
) {
  return handleUnifiedAiBooking({
    workspaceId,
    channel: "voice",
    message: transcript,
    phone,
    contactId,
  });
}

export async function handleEmailAiBooking(
  workspaceId: string,
  email: string,
  subject: string,
  body: string,
  contactId?: string | null,
) {
  const message = [subject, body].filter(Boolean).join("\n\n");
  return handleUnifiedAiBooking({
    workspaceId,
    channel: "email",
    message,
    email,
    contactId,
  });
}
