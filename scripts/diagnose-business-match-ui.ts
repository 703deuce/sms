/**
 * Compare backend word matches vs what the UI bestMatches section receives.
 */
import dotenv from "dotenv";

dotenv.config();

import { mergeCustomerKeywords, suggestIndustryVanityKeywords } from "../src/lib/premium-numbers/business-keyword-llm";
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import { buildProductSearchResponse } from "../src/lib/premium-numbers/product-api";
import { resolveVanityPresentation } from "../src/lib/premium-numbers/vanity-display";
import { BUSINESS_MATCH_LIST_THRESHOLD } from "../src/lib/premium-numbers/scoring-config";

async function main() {
  const industry = process.env.INDUSTRY ?? "electrician";
  const areaCodes = (process.env.AREA_CODES ?? "540,571")
    .split(/[,\s]+/)
    .map((c) => c.replace(/\D/g, "").slice(0, 3))
    .filter((c) => c.length === 3);
  const extras = (process.env.CUSTOM_KEYWORDS ?? "light,plug,wiring,electric")
    .split(/[,\s]+/)
    .filter(Boolean);

  const llm = await suggestIndustryVanityKeywords(industry);
  const customKeywords = mergeCustomerKeywords({
    suggestedKeywords: llm.keywords,
    extraKeywords: extras,
  });

  const searchResult = await searchPremiumNumbers({
    areaCode: areaCodes[0],
    areaCodes,
    industry,
    customKeywords,
    matchStyle: "both",
    limit: 80,
  });

  const product = buildProductSearchResponse({
    mode: "business",
    areaCode: areaCodes[0],
    industry: searchResult.industry,
    status: searchResult.status,
    candidates: searchResult.candidates,
    keywords: searchResult.keywords,
  });

  const wordMatches = searchResult.candidates.filter((c) => c.matchedWords.length > 0);
  const bestSet = new Set(product.bestMatches.map((r) => r.phoneNumber));

  let exactBadge = 0;
  let strongBadge = 0;
  let keywordBadge = 0;
  for (const r of product.bestMatches) {
    if (r.displayWord && r.wordPlacement === "ending" && r.businessMatchScore >= 75) exactBadge += 1;
    else if (r.displayWord && r.wordPlacement === "ending" && r.businessMatchScore >= 55) strongBadge += 1;
    else if (r.displayWord && r.wordPlacement === "embedded") keywordBadge += 1;
  }

  console.log("keywords:", customKeywords.join(", "));
  console.log("API businessMatchCount:", product.businessMatchCount);
  console.log("bestMatches.length (UI cards):", product.bestMatches.length);
  console.log("memorableAlternatives.length:", product.memorableAlternatives.length);
  console.log("candidates with matchedWords:", wordMatches.length);
  console.log(
    "UI badges in bestMatches: EXACT",
    exactBadge,
    "STRONG",
    strongBadge,
    "KEYWORD",
    keywordBadge,
  );

  console.log("\n--- bestMatches (what UI renders) ---");
  for (const r of product.bestMatches) {
    const badge =
      r.displayWord && r.wordPlacement === "ending" && r.businessMatchScore >= 75
        ? "EXACT MATCH"
        : r.displayWord && r.wordPlacement === "ending"
          ? "STRONG MATCH"
          : r.displayWord && r.wordPlacement === "embedded"
            ? "KEYWORD MATCH"
            : "no word badge";
    console.log(
      `${r.displayNumber} | ${r.vanityDisplay ?? "-"} | ${r.displayWord ?? "-"} | ${badge} | bm=${r.businessMatchScore}`,
    );
  }

  console.log("\n--- matchedWords but excluded from bestMatches ---");
  for (const c of wordMatches) {
    if (bestSet.has(c.phoneNumber)) continue;
    const v = resolveVanityPresentation(
      c.phoneNumber,
      c.matchedWords,
      c.rawTelnyx?.vanity_format as string | undefined,
    );
    const reasons: string[] = [];
    if (c.businessMatchScore < BUSINESS_MATCH_LIST_THRESHOLD) {
      reasons.push(`bm<${BUSINESS_MATCH_LIST_THRESHOLD}`);
    }
    if (!v.displayWord) reasons.push("no displayWord");
    console.log(
      `${c.formattedNumber} words=${c.matchedWords.join(",")} display=${v.displayWord ?? "-"} bm=${c.businessMatchScore} why=${reasons.join(";")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
