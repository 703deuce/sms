/**
 * Optional Telnyx conversation message probe — confirms verbal SMS consent
 * when the model omits verbal_sms_consent on the webhook body.
 */

import * as ai from "@/lib/voice/telnyx/ai-client";

const CONSENT_PROMPT_RE =
  /\b(okay if i send|ok if i send|permission to text|send that by text|text you)\b/i;
const AFFIRMATIVE_RE =
  /^\s*(yes|yeah|yep|yup|sure|okay|ok|please|go ahead|that's fine|sounds good)\s*\.?!?\s*$/i;

export async function probeSmsConsentFromTelnyxConversation(input: {
  conversationId: string;
  deadlineMs: number;
}): Promise<{ confirmed: boolean; userUtterance?: string }> {
  const started = Date.now();
  if (!input.conversationId.trim()) return { confirmed: false };
  if (Date.now() > input.deadlineMs) return { confirmed: false };

  try {
    const msgs = await ai.listConversationMessages(input.conversationId, {
      "page[size]": 30,
    });
    const data = (msgs as { data?: unknown[] }).data;
    if (!Array.isArray(data)) return { confirmed: false };

    const rows = [...data].sort((a, b) => {
      const ta = new Date(String((a as Record<string, unknown>).created_at)).getTime();
      const tb = new Date(String((b as Record<string, unknown>).created_at)).getTime();
      return ta - tb;
    });

    let consentPromptAt = -1;
    for (let i = 0; i < rows.length; i++) {
      const msg = rows[i] as Record<string, unknown>;
      const role = String(msg.role || "");
      const text = String(msg.content || msg.text || "").trim();
      if (role === "assistant" && CONSENT_PROMPT_RE.test(text)) {
        consentPromptAt = i;
      }
    }
    if (consentPromptAt < 0) return { confirmed: false };

    for (let j = consentPromptAt + 1; j < rows.length; j++) {
      const msg = rows[j] as Record<string, unknown>;
      if (String(msg.role || "") !== "user") continue;
      const text = String(msg.content || msg.text || "").trim();
      if (AFFIRMATIVE_RE.test(text)) {
        return { confirmed: true, userUtterance: text };
      }
      if (text.length > 0 && !AFFIRMATIVE_RE.test(text)) {
        return { confirmed: false };
      }
    }
  } catch {
    return { confirmed: false };
  }

  if (Date.now() - started > 2500) {
    return { confirmed: false };
  }
  return { confirmed: false };
}
