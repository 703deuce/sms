/**
 * Message translation.
 *
 * Env:
 *   OPENAI_API_KEY — when set, uses OpenAI for real translation
 *   (falls back to a clearly marked demo stub otherwise)
 */

import { openAiChatCompletion } from "@/lib/ai/openai";

const DEMO_PREFIX: Record<string, string> = {
  en: "[en]",
  es: "[es]",
  fr: "[fr]",
  de: "[de]",
  pt: "[pt]",
  zh: "[zh]",
  ja: "[ja]",
};

const DEMO_WORDS: Record<string, Record<string, string>> = {
  es: {
    hello: "hola",
    hi: "hola",
    thanks: "gracias",
    thank: "gracias",
    yes: "sí",
    no: "no",
    please: "por favor",
    help: "ayuda",
    appointment: "cita",
    schedule: "programar",
    today: "hoy",
    tomorrow: "mañana",
  },
  fr: {
    hello: "bonjour",
    hi: "salut",
    thanks: "merci",
    thank: "merci",
    yes: "oui",
    no: "non",
    please: "s'il vous plaît",
    help: "aide",
  },
  de: {
    hello: "hallo",
    hi: "hallo",
    thanks: "danke",
    thank: "danke",
    yes: "ja",
    no: "nein",
    please: "bitte",
    help: "hilfe",
  },
  pt: {
    hello: "olá",
    hi: "olá",
    thanks: "obrigado",
    thank: "obrigado",
    yes: "sim",
    no: "não",
    please: "por favor",
    help: "ajuda",
  },
};

function stubTranslate(text: string, targetLang: string): string {
  const lang = targetLang.toLowerCase().slice(0, 2);
  const prefix = DEMO_PREFIX[lang] || `[${lang}]`;
  const dict = DEMO_WORDS[lang];
  if (!dict) {
    return `${prefix} (demo translation) ${text}`;
  }

  const translated = text
    .split(/\b/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (dict[lower]) {
        const rep = dict[lower];
        if (word === word.toUpperCase()) return rep.toUpperCase();
        if (word[0] === word[0]?.toUpperCase()) {
          return rep.charAt(0).toUpperCase() + rep.slice(1);
        }
        return rep;
      }
      return word;
    })
    .join("");

  return `${prefix} (demo) ${translated}`;
}

export async function translateText(text: string, targetLang: string): Promise<{
  translated: string;
  mode: "openai" | "stub";
  targetLang: string;
}> {
  const trimmed = text.trim();
  const lang = targetLang.trim().toLowerCase().slice(0, 10) || "es";
  if (!trimmed) {
    return { translated: "", mode: "stub", targetLang: lang };
  }

  const llm = await openAiChatCompletion(
    `You are a professional translator. Translate the user's message to ${lang}. Return only the translation, no quotes or explanation.`,
    trimmed,
    { temperature: 0.2, maxTokens: 500 },
  );

  if (llm) {
    return { translated: llm, mode: "openai", targetLang: lang };
  }

  return {
    translated: stubTranslate(trimmed, lang),
    mode: "stub",
    targetLang: lang,
  };
}
