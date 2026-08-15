/**
 * Unit tests for vanity number keypad + scoring (no Telnyx network).
 * Run: npm run test:vanity-number-scoring
 */
import { wordToKeypadDigits } from "../src/lib/premium-numbers/keypad";
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";
import {
  buildVanityDisplay,
  pickEndingVanityWords,
  pickEmbeddedVanityWords,
  resolveVanityPresentation,
  vanityAlignsWithPhone,
} from "../src/lib/premium-numbers/vanity-display";
import { toProductResult } from "../src/lib/premium-numbers/product-api";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function scoreSub(
  subscriber: string,
  industry = "roofing",
  monthlyCost?: string,
) {
  const keywords = buildKeywordEntries({ industry });
  const c = scoreCandidate({
    phoneNumber: `+1703${subscriber}`,
    keywords,
    telnyxCost: monthlyCost ? { monthlyCost } : undefined,
  });
  assert(c !== null, "expected score");
  return c!;
}

assert(wordToKeypadDigits("ROOF") === "7663");
assert(wordToKeypadDigits("MOVERS") === "668377");

assert(
  buildVanityDisplay("+12402077275", ["SPARK"]) === "240-20-SPARK",
  "SPARK vanity must be 10 chars (240-20-SPARK)",
);
assert(
  buildVanityDisplay("+12409186587", ["VOLTS"]) === "240-91-VOLTS",
  "VOLTS vanity must be 10 chars (240-91-VOLTS)",
);
assert(
  buildVanityDisplay("+15712766337", ["ROOFER"]) === "571-2-ROOFER",
  "ROOFER vanity must be 10 chars (571-2-ROOFER)",
);
assert(
  pickEndingVanityWords("+17575296262", ["LAWN"]).length === 0,
  "5296262 must not end with LAWN letters",
);
assert(
  pickEmbeddedVanityWords("+17575296262", ["LAWN"]).includes("LAWN"),
  "5296262 must embed LAWN letters",
);
assert(
  pickEndingVanityWords("+15409295296", ["LAWN"]).includes("LAWN"),
  "9295296 must end with LAWN letters",
);

assert(
  buildVanityDisplay("+17575296262", ["LAWN"]) === "757-LAWN-262",
  "embedded LAWN vanity must show trailing digits",
);
const lawnEmbedded = resolveVanityPresentation("+17575296262", ["LAWN"]);
assert(lawnEmbedded.displayWord === "LAWN", "embedded LAWN displayWord");
assert(lawnEmbedded.wordPlacement === "embedded", "embedded LAWN placement");

const lawnContainsProduct = toProductResult(
  scoreCandidate({
    phoneNumber: "+17575296262",
    keywords: buildKeywordEntries({ industry: "lawn_care" }),
  })!,
  "business",
  buildKeywordEntries({ industry: "lawn_care" }),
  "memorable_alternative",
  "757",
);
assert(lawnContainsProduct.displayWord === "LAWN", "embedded LAWN sets displayWord");
assert(lawnContainsProduct.wordPlacement === "embedded", "embedded LAWN placement in product");
assert(
  lawnContainsProduct.cardBullets.some((b) => b.includes("lawn in number")),
  "embedded LAWN must describe in-number keyword",
);
assert(
  !lawnContainsProduct.cardBullets.some((b) => b.toLowerCase().includes("exact")),
  "embedded LAWN must not claim exact match",
);
assert(
  lawnContainsProduct.premiumPriceCents < 4900,
  "embedded LAWN must not get ending-word $49 pricing",
);

assert(
  vanityAlignsWithPhone("757-607-YARD", "+17576079273"),
  "757-607-YARD must align with 7576079273",
);
assert(
  vanityAlignsWithPhone("757-LAWN-262", "+17575296262"),
  "757-LAWN-262 must align with 7575296262",
);
assert(
  !vanityAlignsWithPhone("757-529-LAWN", "+17575296262"),
  "mislabeled ending vanity must fail digit alignment",
);

assert(
  buildVanityDisplay("+12402077275", ["SPARK"]) !== "240-207-SPARK",
  "SPARK vanity must not use 11-char exchange format",
);

const plain1111 = scoreSub("2401111", "roofing", "5");
const roof777 = scoreSub("7777663", "roofing", "1");
const roof704 = scoreSub("7047663", "roofing", "1");
const lawn5296 = scoreSub("9295296", "lawn_care", "1");
const mower = scoreSub("2966937", "lawn_care", "1");
const repeater4444 = scoreSub("5724444", "lawn_care", "5");
const abab = scoreSub("9321212", "roofing", "1");

assert(plain1111.score < mower.score, "MOWER should beat plain 1111 repeater");
assert(mower.score > lawn5296.score, "MOWER should beat LAWN for lawn care");
assert(lawn5296.score > repeater4444.score, "LAWN should beat 4444 repeater for lawn care");
assert(roof777.score > plain1111.score, "777-ROOF should beat plain 1111");
assert(roof777.score > roof704.score, "777-ROOF should beat plain ROOF ending");
assert(roof704.businessMatchScore >= 60, "4-digit ROOF business match should be strong");

assert(mower.businessMatchScore > lawn5296.businessMatchScore, "MOWER BM > LAWN BM");
assert(repeater4444.businessMatchScore < 10, "4444 should have near-zero business match");

const weakMow = scoreSub("6988669", "lawn_care", "1");
assert(weakMow.businessMatchScore < 40, "3-digit MOW should be weak business match");

const a = scoreSub("7777663");
const b = scoreSub("7777663");
assert(a.score === b.score, "deterministic");

console.log("vanity-number-scoring tests passed");
console.log(`  571-240-1111 => ${plain1111.score} (BM ${plain1111.businessMatchScore} / NQ ${plain1111.numberQualityScore})`);
console.log(`  540-296-MOWER => ${mower.score} (BM ${mower.businessMatchScore} / NQ ${mower.numberQualityScore})`);
console.log(`  540-929-LAWN => ${lawn5296.score} (BM ${lawn5296.businessMatchScore} / NQ ${lawn5296.numberQualityScore})`);
console.log(`  540-572-4444 => ${repeater4444.score} (BM ${repeater4444.businessMatchScore} / NQ ${repeater4444.numberQualityScore})`);
console.log(`  571-777-ROOF => ${roof777.score} (BM ${roof777.businessMatchScore} / NQ ${roof777.numberQualityScore})`);
