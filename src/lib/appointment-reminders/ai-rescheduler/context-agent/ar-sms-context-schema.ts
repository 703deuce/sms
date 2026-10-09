import { z } from "zod";

export const AR_SMS_CONTEXT_INTENTS = [
  "confirm_attendance",
  "reschedule_request",
  "cancel_request",
  "availability_question",
  "appointment_question",
  "business_question",
  "acknowledgment",
  "greeting",
  "ambiguous_attendance",
  "correction",
  "other",
] as const;

export const AR_SMS_CONVERSATION_RELATIONSHIPS = [
  "new_request",
  "continuation",
  "answer_to_pending_question",
  "correction",
  "acknowledgment",
  "unrelated",
] as const;

export const AR_SMS_AUTHORIZATION_STATES = [
  "none",
  "request_only",
  "confirmation_of_pending_action",
  "rejection_of_pending_action",
  "unclear",
] as const;

export const AR_SMS_INTENT_CONFIDENCE = ["high", "medium", "low"] as const;

export const AR_SMS_PENDING_OFFER_RESPONSE = [
  "none",
  "acceptance",
  "rejection",
  "unclear",
] as const;

export const AR_SMS_APPOINTMENT_REFERENCE = [
  "current_reminder",
  "other_appointment",
  "ambiguous",
] as const;

export const arSmsContextInterpretationSchema = z
  .object({
  intent: z.enum(AR_SMS_CONTEXT_INTENTS),
  intent_confidence: z.enum(AR_SMS_INTENT_CONFIDENCE),
  conversation_relationship: z.enum(AR_SMS_CONVERSATION_RELATIONSHIPS),
  appointment_reference: z.enum(AR_SMS_APPOINTMENT_REFERENCE),
  requested_change: z
    .object({
      date_expression: z.string().nullable().optional(),
      time_expression: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  pending_offer_response: z.enum(AR_SMS_PENDING_OFFER_RESPONSE),
  customer_authorization: z.enum(AR_SMS_AUTHORIZATION_STATES),
  needs_clarification: z.boolean(),
  clarification_topic: z.string().nullable().optional(),
  relevant_context: z.string().max(2000),
})
  .strict();

export type ArSmsContextInterpretation = z.infer<typeof arSmsContextInterpretationSchema>;

export const arSmsContextInterpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "intent_confidence",
    "conversation_relationship",
    "appointment_reference",
    "pending_offer_response",
    "customer_authorization",
    "needs_clarification",
    "relevant_context",
  ],
  properties: {
    intent: { type: "string", enum: [...AR_SMS_CONTEXT_INTENTS] },
    intent_confidence: { type: "string", enum: [...AR_SMS_INTENT_CONFIDENCE] },
    conversation_relationship: { type: "string", enum: [...AR_SMS_CONVERSATION_RELATIONSHIPS] },
    appointment_reference: { type: "string", enum: [...AR_SMS_APPOINTMENT_REFERENCE] },
    requested_change: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["date_expression", "time_expression"],
          properties: {
            date_expression: { type: ["string", "null"] },
            time_expression: { type: ["string", "null"] },
          },
        },
        { type: "null" },
      ],
    },
    pending_offer_response: { type: "string", enum: [...AR_SMS_PENDING_OFFER_RESPONSE] },
    customer_authorization: { type: "string", enum: [...AR_SMS_AUTHORIZATION_STATES] },
    needs_clarification: { type: "boolean" },
    clarification_topic: { type: ["string", "null"] },
    relevant_context: { type: "string" },
  },
} as const;

export function parseArSmsContextInterpretation(raw: unknown): ArSmsContextInterpretation | null {
  const parsed = arSmsContextInterpretationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function fallbackArSmsContextInterpretation(reason: string): ArSmsContextInterpretation {
  return {
    intent: "other",
    intent_confidence: "low",
    conversation_relationship: "unrelated",
    appointment_reference: "current_reminder",
    pending_offer_response: "none",
    customer_authorization: "unclear",
    needs_clarification: true,
    clarification_topic: reason,
    relevant_context: reason,
  };
}
