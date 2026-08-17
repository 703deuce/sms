import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { llmChatCompletion } from "@/lib/ai/llm";

export async function explainNumberResult(input: {
  result: PremiumNumberProductResult;
  searchSummary: string;
}): Promise<string> {
  const system =
    "You explain why a real available phone number is a good fit. Never invent numbers or prices. Be concise (2-4 sentences).";
  const user = JSON.stringify({
    searchSummary: input.searchSummary,
    number: {
      phone: input.result.displayNumber,
      vanity: input.result.vanityDisplay,
      word: input.result.displayWord,
      priceCents: input.result.premiumPriceCents,
      businessScore: input.result.businessMatchScore,
      qualityScore: input.result.numberQualityScore,
      bullets: input.result.cardBullets,
      why: input.result.whyReasons,
    },
  });

  const llm = await llmChatCompletion(system, user, { maxTokens: 400 });
  return llm?.content?.trim() || "This number matches your current search criteria and scoring profile.";
}

export async function compareNumberResults(input: {
  results: PremiumNumberProductResult[];
  searchSummary: string;
}): Promise<string> {
  const system =
    "Compare real phone number options. Use headings: Best Overall, Best Value, Best Pattern. Never invent numbers.";
  const user = JSON.stringify({
    searchSummary: input.searchSummary,
    numbers: input.results.map((r) => ({
      phone: r.displayNumber,
      vanity: r.vanityDisplay,
      priceCents: r.premiumPriceCents,
      businessScore: r.businessMatchScore,
      qualityScore: r.numberQualityScore,
      word: r.displayWord,
    })),
  });
  const llm = await llmChatCompletion(system, user, { maxTokens: 600 });
  return llm?.content?.trim() || "Compare the scores and prices above to pick the best fit.";
}
