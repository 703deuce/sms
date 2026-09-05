import "server-only";

import { openAiChatCompletion } from "@/lib/ai/openai";
import { SCHEDULING_INTENT_JSON_SCHEMA, validateSchedulingIntent, type SchedulingIntent } from "./intent-schema";
import { parseUnderstandingFallback } from "./understand-fallback";
import { assembleAppointmentAiContext } from "./context";
import { parseSchedulingIntentFallback } from "./intent-parser-fallback";

export { parseSchedulingIntentFallback } from "./intent-parser-fallback";

export async function parseSchedulingIntent(input: {
  text: string;
  appointmentTypes?: Array<{ id: string; name: string }>;
  timezone?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  workspaceId?: string;
}): Promise<SchedulingIntent> {
  if (input.workspaceId) {
    const ctx = await assembleAppointmentAiContext({
      requestId: "legacy-parser",
      workspaceId: input.workspaceId,
      channel: "public_booking",
      message: input.text,
      conversationHistory: input.conversationHistory,
    });
    const fallbackUnderstanding = parseUnderstandingFallback(input.text, ctx);
    const { understanding } = await import("./understand").then((m) =>
      m.runUnderstandingAgent(ctx, fallbackUnderstanding),
    );
    return {
      intent:
        understanding.intent === "FIND_AVAILABILITY"
          ? "availability_request"
          : understanding.intent === "BOOK"
            ? "new_booking"
            : understanding.intent === "RESCHEDULE"
              ? "reschedule"
              : understanding.intent === "CANCEL"
                ? "cancel"
                : understanding.intent === "CONFIRM"
                  ? "confirm"
                  : "availability_request",
      appointmentTypeId: understanding.servicePreference.appointmentTypeId || undefined,
      appointmentTypeName: understanding.servicePreference.nameMentioned || undefined,
      requestedDate: understanding.datePreference.date || undefined,
      preferredTime: understanding.timePreference.exactTime || undefined,
      timeOfDay: understanding.timePreference.period || undefined,
      staffPreference: understanding.staffPreference.nameMentioned || undefined,
      locationPreference: understanding.locationPreference.nameMentioned || undefined,
      originalText: input.text,
      confidence: understanding.confidence,
      missingFields: understanding.requiresClarification ? ["clarification"] : undefined,
      followUpQuestion: understanding.clarificationReason || undefined,
    };
  }

  const fallback = parseSchedulingIntentFallback(input.text, {
    appointmentTypes: input.appointmentTypes,
    timezone: input.timezone,
  });

  const typeList =
    input.appointmentTypes?.map((t) => `${t.name} (id: ${t.id})`).join(", ") || "none";

  const system = `You extract structured appointment scheduling intent from natural language.
Return ONLY valid JSON matching this schema:
${SCHEDULING_INTENT_JSON_SCHEMA}

Rules:
- Never invent availability or appointment times.
- Only extract what the customer said or clearly implied.
- Available appointment types: ${typeList}
- Timezone: ${input.timezone || "America/New_York"}
- If appointment type is ambiguous and multiple types exist, set missingFields and followUpQuestion.
- confidence should reflect how certain you are (0-1).`;

  const history = (input.conversationHistory || [])
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const user = [
    history ? `Conversation:\n${history}\n` : "",
    `Customer message: ${input.text}`,
    "JSON:",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await openAiChatCompletion(system, user, { temperature: 0.1, maxTokens: 500 });
    if (!raw) return fallback;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    parsed.originalText = input.text;
    const validated = validateSchedulingIntent(parsed);
    if (!validated) return fallback;
    return validated;
  } catch (err) {
    console.warn("[ai-scheduling] intent parse failed, using fallback", err);
    return fallback;
  }
}
