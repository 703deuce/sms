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
import { analyzePersonalNumber, applyPersonalScoringToCandidate } from "../src/lib/premium-numbers/personal-pattern-scoring";
import {
  quotePremiumPrice,
  formatPremiumPrice,
} from "../src/lib/premium-numbers/premium-pricing";

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

// Personal pattern pricing ladder
function personalScore(phone: string) {
  const c = scoreCandidate({
    phoneNumber: phone,
    keywords: buildKeywordEntries({}),
    telnyxCost: { monthlyCost: "1" },
  })!;
  const scored = applyPersonalScoringToCandidate(c);
  const price = quotePremiumPrice(scored, "personal", { areaCode: phone.replace(/\D/g, "").slice(1, 4) });
  return { scored, price };
}

const num1212 = personalScore("+17575681212");
const num1331 = personalScore("+17575681331");
const num1111 = personalScore("+17575681111");
const num5000 = personalScore("+17575005000");

assert(num1212.scored.personalPattern?.tier === "memorable", "1212 should be memorable tier");
assert(num1212.price.premiumPriceCents === 1900, `1212 launch price $19, got ${formatPremiumPrice(num1212.price.premiumPriceCents)}`);
assert(num1331.scored.personalPattern?.tier === "nice", "1331 should be nice tier (weak palindrome)");
assert(
  num1331.price.premiumPriceCents <= 900,
  `1331 should be $5–9, got ${formatPremiumPrice(num1331.price.premiumPriceCents)}`,
);
assert(num1212.price.premiumPriceCents > num1331.price.premiumPriceCents, "1212 must beat 1331 in price");
assert(num1111.scored.personalPattern?.tier === "very_memorable", "1111 should be very memorable");
assert(
  num1111.price.premiumPriceCents >= 2900 && num1111.price.premiumPriceCents <= 3900,
  `1111 launch $29–39, got ${formatPremiumPrice(num1111.price.premiumPriceCents)}`,
);
assert(num5000.scored.personalPattern?.tier === "exceptional", "500-5000 should be exceptional");
assert(
  num5000.price.premiumPriceCents >= 4900,
  `500-5000 launch $49+, got ${formatPremiumPrice(num5000.price.premiumPriceCents)}`,
);

const junk = scoreCandidate({
  phoneNumber: "+12134515865",
  keywords: buildKeywordEntries({ industry: "junk_removal" }),
  telnyxCost: { monthlyCost: "1" },
})!;
const junkProduct = toProductResult(
  junk,
  "business",
  buildKeywordEntries({ industry: "junk_removal" }),
  "business_match",
  "213",
);
assert(junkProduct.displayWord === "JUNK", "JUNK display word");
assert(
  junkProduct.premiumPriceCents >= 7900 && junkProduct.premiumPriceCents <= 9900,
  `JUNK launch $79–99, got ${formatPremiumPrice(junkProduct.premiumPriceCents)}`,
);

console.log("personal/business pricing ladder tests passed");
