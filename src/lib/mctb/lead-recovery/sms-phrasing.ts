import { finalizeMctbOutboundSms, MCTB_SMS_CHANNEL_SYSTEM } from "@/lib/mctb/sms-channel";
import { aiBookingStructuredJson } from "@/lib/mctb/ai-booking/agents/json-llm";
import { getAiBookingPhrasingModel } from "@/lib/mctb/ai-booking/agents/model-config";

const LEAD_RECOVERY_PHRASING_SYSTEM = `${MCTB_SMS_CHANNEL_SYSTEM}

You phrase SMS replies for lead recovery (scheduling, callbacks, urgent service).
Use only facts provided. Never claim booking or payment success unless facts say so.
Return JSON only: {"reply":"your SMS text"}`;

export async function phraseLeadRecoverySmsReply(input: {
  facts: Record<string, unknown>;
  fallbackText: string;
}): Promise<string> {
  const certDeepSeek = process.env.LR_CERT_FORCE_DEEPSEEK === "1";
  if (certDeepSeek) {
    try {
      const { deepSeekStructuredJson } = await import(
        "@/lib/mctb/lead-recovery/testing/cert-model"
      );
      const llm = await deepSeekStructuredJson<{ reply?: string }>({
        system: LEAD_RECOVERY_PHRASING_SYSTEM,
        user: JSON.stringify({ facts: input.facts }),
        temperature: 0.2,
        maxTokens: 120,
      });
      if (llm.data.reply?.trim()) return finalizeMctbOutboundSms(llm.data.reply);
    } catch {
      /* use fallback */
    }
    return finalizeMctbOutboundSms(input.fallbackText);
  }

  const structured = await aiBookingStructuredJson<{ reply?: string }>({
    system: LEAD_RECOVERY_PHRASING_SYSTEM,
    user: JSON.stringify({ facts: input.facts, required: "reply field with SMS text" }),
    model: getAiBookingPhrasingModel(),
    maxTokens: 120,
  });
  if (structured?.reply?.trim()) return finalizeMctbOutboundSms(structured.reply);
  return finalizeMctbOutboundSms(input.fallbackText);
}
