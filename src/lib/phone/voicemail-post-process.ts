import { telnyxInferenceChatCompletion, isTelnyxInferenceChatConfigured } from "@/lib/voice/telnyx/inference-chat";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { translateText } from "@/lib/ai/translate";

const ENGLISH_LANG_CODES = new Set(["en", "english"]);

function isLikelyEnglish(language?: string | null): boolean {
  const code = (language || "").trim().toLowerCase();
  if (!code) return true;
  return ENGLISH_LANG_CODES.has(code) || code.startsWith("en");
}

async function chatForVoicemail(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  if (isTelnyxInferenceChatConfigured()) {
    const result = await telnyxInferenceChatCompletion(system, user, {
      temperature: 0.2,
      maxTokens,
    });
    return result?.content?.trim() || null;
  }
  const fallback = await openAiChatCompletion(system, user, {
    temperature: 0.2,
    maxTokens,
  });
  return fallback?.trim() || null;
}

export async function translateVoicemailToEnglish(
  transcript: string,
  detectedLanguage?: string | null,
): Promise<string | null> {
  const text = transcript.trim();
  if (!text) return null;
  if (isLikelyEnglish(detectedLanguage)) return null;

  if (isTelnyxInferenceChatConfigured()) {
    const translated = await chatForVoicemail(
      "Translate the following voicemail transcript to English. Return only the translation, no quotes or preamble.",
      text,
      800,
    );
    return translated?.trim() || null;
  }

  const result = await translateText(text, "en");
  return result.translated.trim() || null;
}

export async function summarizeVoicemailTranscript(transcript: string): Promise<string | null> {
  const text = transcript.trim();
  if (!text) return null;
  return chatForVoicemail(
    "Summarize this voicemail in 1-2 short sentences for a business owner. Focus on who called and what they need. No bullet points.",
    text,
    120,
  );
}
