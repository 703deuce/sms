import type { CustomerSafeNumberResult } from "./customer-context";
import { llmChatCompletion } from "@/lib/ai/llm";

export async function explainNumberResult(input: {
  result: CustomerSafeNumberResult;
  searchSummary: string;
}): Promise<string> {
  const system =
    "You explain why a real available phone number is a good fit. Never invent numbers or prices. Never mention carriers, providers, wholesale costs, margins, or internal systems. Be concise (2-4 sentences).";
  const user = JSON.stringify({
    searchSummary: input.searchSummary,
    number: {
      phone: input.result.displayNumber,
      vanity: input.result.vanityDisplay,
      word: input.result.displayWord,
      retailPriceCents: input.result.retailPriceCents,
      businessScore: input.result.businessMatchScore,
      qualityScore: input.result.numberQualityScore,
      bullets: input.result.scoreComponents?.cardBullets,
      why: input.result.scoreComponents?.whyReasons,
    },
  });

  const llm = await llmChatCompletion(system, user, { maxTokens: 400 });
  return llm?.content?.trim() || "This number matches your current search criteria and scoring profile.";
}

export async function compareNumberResults(input: {
  results: CustomerSafeNumberResult[];
  searchSummary: string;
}): Promise<string> {
  const system =
    "Compare real phone number options. Use headings: Best Overall, Best Value, Best Pattern. Never invent numbers. Never mention carriers, providers, wholesale costs, or internal metadata.";
  const user = JSON.stringify({
    searchSummary: input.searchSummary,
    numbers: input.results.map((r) => ({
      phone: r.displayNumber,
      vanity: r.vanityDisplay,
      retailPriceCents: r.retailPriceCents,
      businessScore: r.businessMatchScore,
      qualityScore: r.numberQualityScore,
      word: r.displayWord,
    })),
  });
  const llm = await llmChatCompletion(system, user, { maxTokens: 600 });
  return llm?.content?.trim() || "Compare the scores and prices above to pick the best fit.";
}
