import { openAiChatCompletion } from "@/lib/ai/openai";
import { translateText } from "@/lib/ai/translate";

const ENGLISH_LANG_CODES = new Set(["en", "english"]);

function isLikelyEnglish(language?: string | null): boolean {
  const code = (language || "").trim().toLowerCase();
  if (!code) return true;
  return ENGLISH_LANG_CODES.has(code) || code.startsWith("en");
}

export async function translateVoicemailToEnglish(
  transcript: string,
  detectedLanguage?: string | null,
): Promise<string | null> {
  const text = transcript.trim();
  if (!text) return null;
  if (isLikelyEnglish(detectedLanguage)) return null;
  const result = await translateText(text, "en");
  return result.translated.trim() || null;
}

export async function summarizeVoicemailTranscript(transcript: string): Promise<string | null> {
  const text = transcript.trim();
  if (!text) return null;
  const summary = await openAiChatCompletion(
    "Summarize this voicemail in 1-2 short sentences for a business owner. Focus on who called and what they need. No bullet points.",
    text,
    { temperature: 0.2, maxTokens: 120 },
  );
  return summary?.trim() || null;
}
