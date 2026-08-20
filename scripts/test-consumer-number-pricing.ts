/**
 * Hermetic consumer number scoring, pricing, merchandising, and quote-path tests.
 */
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";
import { displayLaunchPrice } from "../src/lib/premium-numbers/launch-pricing";
import { detectNumericPatterns } from "../src/lib/premium-numbers/pattern-detect";
import {
  buildMaxPriceCollection,
  buildProductSearchResponse,
  merchandisePersonalResults,
  toProductResult,
} from "../src/lib/premium-numbers/product-api";
import {
  normalizedProviderCosts,
  PREMIUM_PRICE_POLICY,
  quotePremiumPrice,
} from "../src/lib/premium-numbers/premium-pricing";
import {
  findCheckoutAuthoritativeQuote,
  serializeResultsForLog,
} from "../src/lib/premium-numbers/reservation-service";
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";
import type { KeywordEntry, ScoredCandidate } from "../src/lib/premium-numbers/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const noKeywords: KeywordEntry[] = [];
function personal(
  subscriber: string,
  options: {
    provider?: "telnyx" | "twilio";
    providerReference?: string;
    upfrontCost?: string;
    monthlyCost?: string;
    nameTokens?: string[];
    keywords?: KeywordEntry[];
    areaCode?: string;
  } = {},
): ScoredCandidate {
  const areaCode = options.areaCode ?? "703";
  const result = scoreCandidate({
    phoneNumber: `+1${areaCode}${subscriber}`,
    keywords: options.keywords ?? noKeywords,
    provider: options.provider ?? "telnyx",
    providerReference: options.providerReference ?? "provider-ref",
    telnyxCost:
      options.upfrontCost || options.monthlyCost
        ? { upfrontCost: options.upfrontCost, monthlyCost: options.monthlyCost, currency: "USD" }
        : undefined,
    searchContext: {
      mode: "personal",
      requestedAreaCodes: [areaCode],
      personalPreferences: options.nameTokens ? { nameTokens: options.nameTokens } : undefined,
    },
  });
  assert(result, `could not score ${subscriber}`);
  return result;
}

function ids(subscriber: string): string[] {
  return detectNumericPatterns(subscriber).map((item) => item.id);
}

assert(ids("5837042").length === 0, "ordinary random number should have no pattern");
assert(ids("5837044").includes("ending_pair"), "one ending pair");
assert(ids("5518233").includes("two_pairs"), "two pairs");
assert(ids("5812777").includes("last3_identical"), "triple");
assert(ids("5817777").includes("last4_identical"), "quadruple");
assert(ids("5811122").includes("aabb"), "AABB");
assert(ids("5811212").includes("abab"), "ABAB");
assert(ids("5811221").includes("abba"), "ABBA");
assert(ids("5810000").includes("ends_0000"), "0000");
assert(ids("5811000").includes("ends_x000"), "X000 / 1000");
assert(ids("5811234").includes("sequence"), "ascending sequence");
assert(ids("5814321").includes("sequence"), "descending sequence");
assert(
  personal("1234589").numberQualityScore < personal("5812345").numberQualityScore,
  "hidden sequence receives a weaker score than a clean ending",
);
assert(ids("1234321").includes("full_palindrome"), "full palindrome");
assert(ids("1234123").includes("repeated_prefix_line"), "repeated prefix and line");

const amy = personal("2695837", { nameTokens: ["AMY"] });
assert((amy.personalMatchScore ?? 0) >= 12, "personal-name T9 relevance");

const roofKeywords = buildKeywordEntries({ industry: "roofing", primaryKeywords: ["ROOF"] });
const businessRoof = scoreCandidate({
  phoneNumber: "+17035817663",
  keywords: roofKeywords,
  searchContext: { mode: "business", industry: "roofing", explicitKeywords: ["ROOF"] },
});
const personalRoof = personal("5817663", { keywords: roofKeywords });
assert(businessRoof && businessRoof.businessMatchScore >= 55, "business-word T9 quality preserved");
assert(personalRoof.businessMatchScore === 0, "personal context must not receive business inflation");
const businessProduct = toProductResult(businessRoof, "business", roofKeywords, "business_match", "703");
assert(businessProduct.premiumPriceCents >= 4900, "clear commercial words retain business pricing");

const businessAlternatives = merchandisePersonalResults(
  [
    toProductResult(personal("7884444", { upfrontCost: "$2.00", monthlyCost: "$10.00" }), "business", [], "memorable_alternative", "703"),
    toProductResult(personal("6002525"), "business", [], "memorable_alternative", "703"),
    toProductResult(personal("6964242"), "business", [], "memorable_alternative", "703"),
    toProductResult(personal("7594747"), "business", [], "memorable_alternative", "703"),
  ],
  { limit: 4 },
);
assert(
  businessAlternatives.slice(0, 3).every((item) => item.premiumPriceCents <= 3999),
  "business memorable alternatives prefer consumer tiers before provider-cost outliers",
);
assert(
  businessAlternatives.at(-1)?.premiumPriceCents === 15999,
  "provider-cost outliers remain available but move to the back",
);

const pricingCases: Array<{
  label: string;
  subscriber: string;
  exact?: number;
  min?: number;
  max?: number;
}> = [
  { label: "ordinary", subscriber: "5837042", exact: 499 },
  { label: "weak ending pair", subscriber: "5837044", exact: 499 },
  { label: "two pairs", subscriber: "5518233", exact: 799 },
  { label: "ABAB", subscriber: "5811212", min: 799, max: 1499 },
  { label: "AABB", subscriber: "5811122", min: 799, max: 1499 },
  { label: "ABBA", subscriber: "5811221", min: 799, max: 1499 },
  { label: "ascending 1234", subscriber: "5811234", min: 799, max: 1499 },
  { label: "descending 4321", subscriber: "5814321", min: 799, max: 1499 },
  { label: "salient ending triple", subscriber: "5812777", exact: 1499 },
  { label: "framed interior triple rhythm", subscriber: "7171117", exact: 1999 },
  { label: "ending 7777", subscriber: "5817777", exact: 2999 },
  { label: "ending 0000", subscriber: "5810000", exact: 2999 },
  { label: "full repeated", subscriber: "1111111", exact: 3999 },
  { label: "full ascending sequence", subscriber: "1234567", exact: 3999 },
  { label: "2727 guardrail", subscriber: "5812727", min: 799, max: 1499 },
  { label: "2200 guardrail", subscriber: "5812200", min: 799, max: 1499 },
  { label: "spec 2727", subscriber: "4282727", exact: 799 },
  { label: "spec 2233", subscriber: "8812233", exact: 999 },
  { label: "spec 2525", subscriber: "4452525", exact: 999 },
  { label: "spec 3300", subscriber: "6833300", exact: 999 },
  { label: "spec 6600", subscriber: "6066600", exact: 1499 },
  { label: "spec 1221", subscriber: "4881221", exact: 1499 },
];
const pricedExamples = pricingCases.map((row) => {
  const candidate = personal(row.subscriber);
  const quote = quotePremiumPrice(candidate, "personal");
  const product = toProductResult(candidate, "personal", [], "top_pick", "703");
  if (row.exact != null) {
    assert(quote.premiumPriceCents === row.exact, `${row.label} quote should be ${row.exact}`);
    assert(product.premiumPriceCents === row.exact, `${row.label} product DTO should be ${row.exact}`);
  } else {
    assert(
      quote.premiumPriceCents >= (row.min ?? 0) && quote.premiumPriceCents <= (row.max ?? Infinity),
      `${row.label} quote should be in ${row.min}-${row.max}`,
    );
    assert(
      product.premiumPriceCents === quote.premiumPriceCents,
      `${row.label} product DTO should use its authoritative quote`,
    );
  }
  return { ...row, candidate, product, price: quote.premiumPriceCents };
});

const rhythmic = personal("7171117");
const isolatedTriple = personal("5812777");
assert(
  rhythmic.numberQualityScore >= isolatedTriple.numberQualityScore + 15,
  "full-number framed rhythm should substantially beat an isolated ending triple",
);

const areaRelated = personal("7035842", { areaCode: "703" });
const areaUnrelated = personal("7035842", { areaCode: "704" });
const areaDelta = areaRelated.numberQualityScore - areaUnrelated.numberQualityScore;
assert(areaDelta > 0 && areaDelta <= 4, "visible area-code relationship is positive and modest");
assert(
  areaRelated.personalMatchScore === areaUnrelated.personalMatchScore,
  "area relationship is not the requested-area match",
);
assert(
  areaRelated.numberQualityReasons.some((reason) => reason.label.includes("area code")),
  "area relationship is distinct from requested-area relevance",
);
const personalTierIndex = (price: number) => PREMIUM_PRICE_POLICY.personal.tiers.indexOf(
  price as (typeof PREMIUM_PRICE_POLICY.personal.tiers)[number],
);
assert(
  Math.abs(
    personalTierIndex(quotePremiumPrice(areaRelated, "personal").premiumPriceCents) -
      personalTierIndex(quotePremiumPrice(areaUnrelated, "personal").premiumPriceCents),
  ) <= 1,
  "area relationship alone cannot move more than one personal tier",
);

const logRows = serializeResultsForLog(pricedExamples.map((row) => row.product));
for (const row of pricedExamples) {
  const stored = logRows.find((result) => result.phoneNumber === row.product.phoneNumber);
  const checkoutQuote = findCheckoutAuthoritativeQuote(logRows, row.product.phoneNumber);
  assert(stored?.premiumPriceCents === row.price, `${row.label} search log cents`);
  assert(checkoutQuote?.premiumPriceCents === row.price, `${row.label} checkout-authoritative cents`);
}

const expensive = personal("5837042", {
  provider: "twilio",
  providerReference: "PN-preserve-me",
  upfrontCost: "$2.00",
  monthlyCost: "$10.00",
});
const costs = normalizedProviderCosts(expensive);
const expensiveProduct = toProductResult(expensive, "personal", [], "top_pick", "703");
assert(costs.upfrontCents === 200 && costs.monthlyCents === 1000, "normalized provider costs");
assert(expensiveProduct.premiumPriceCents > 3999, "hard provider economics enforce above-tier floor");
assert(expensiveProduct.provider === "twilio", "provider identity preserved");
assert(expensiveProduct.providerReference === "PN-preserve-me", "provider reference preserved");
const expensiveLog = serializeResultsForLog([expensiveProduct]);
assert(
  findCheckoutAuthoritativeQuote(expensiveLog, expensiveProduct.phoneNumber)?.premiumPriceCents ===
    expensiveProduct.premiumPriceCents,
  "provider floor survives search log and checkout quote",
);

const merchandisingCandidates = [
  ...pricedExamples.map((row) => row.candidate),
  personal("1115834"),
];
const products = merchandisingCandidates.map((candidate) =>
  toProductResult(candidate, "personal", [], "top_pick", "703"),
);
const merchandise = merchandisePersonalResults([expensiveProduct, ...products], { limit: 7 });
const openingPrices = merchandise.slice(0, 5).map((item) => item.premiumPriceCents);
assert(openingPrices[0] === 499, "merchandising opens with $4.99 when available");
assert(openingPrices.includes(799) && openingPrices.includes(999), "merchandising includes $7.99/$9.99");
assert(openingPrices.includes(1499), "merchandising includes $14.99");
assert(openingPrices.filter((price) => price >= 1999).length <= 1, "opening has at most one $19.99+ item");
assert(
  merchandise.every((item) => item.premiumPriceCents <= 3999),
  "provider-cost outliers must not displace available consumer-tier inventory",
);
assert(buildMaxPriceCollection(products, 1000).every((item) => item.premiumPriceCents <= 1000), "max-price helper");

const homepage = buildProductSearchResponse({
  mode: "personal",
  areaCode: "703",
  status: "RESULTS_FOUND",
  candidates: merchandisingCandidates,
  keywords: [],
});
const homepageItems = homepage.topPicks ?? [];
const logged = serializeResultsForLog(homepageItems);
for (const item of homepageItems) {
  const display = displayLaunchPrice(item.premiumPriceCents, item.premiumPriceBand);
  const stored = logged.find((row) => row.phoneNumber === item.phoneNumber);
  assert(display.priceCents === item.premiumPriceCents, "homepage must display authoritative quote");
  assert(!display.listPriceCents && !display.showLaunchBadge, "no fabricated launch discount");
  assert(stored?.premiumPriceCents === item.premiumPriceCents, "product DTO and reservation log quote agree");
  assert(item.tags.length > 0 && item.tags.every((tag) => !/\d+\/100/.test(tag)), "consumer labels do not expose scores");
}

let seed = 0x5eed1234;
const distribution = new Map<number, number>();
for (let index = 0; index < 20_000; index++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const subscriber = String(2_000_000 + (seed % 8_000_000));
  const price = quotePremiumPrice(personal(subscriber), "personal").premiumPriceCents;
  distribution.set(price, (distribution.get(price) ?? 0) + 1);
}
const configured = new Set<number>(PREMIUM_PRICE_POLICY.personal.tiers);
assert([...distribution.keys()].every((price) => configured.has(price)), "normal inventory uses configured retail tiers");
const total = [...distribution.values()].reduce((sum, count) => sum + count, 0);
const high = (distribution.get(2999) ?? 0) + (distribution.get(3999) ?? 0);
assert(high / total < 0.02, "$29.99 must be uncommon and $39.99 rare");
assert((distribution.get(3999) ?? 0) / total < 0.002, "$39.99 must be rare");
const consumerTiers = [499, 799, 999, 1499, 1999].reduce(
  (sum, price) => sum + (distribution.get(price) ?? 0),
  0,
);
assert(consumerTiers / total > 0.98, "ordinary personal inventory stays in consumer tiers");

console.log("consumer-number-pricing tests passed");
console.log(
  `  exact examples: ${pricedExamples.map((row) => `${row.label}=${row.price}`).join(", ")}`,
);
console.log(`  merchandising opening: ${openingPrices.join(", ")}`);
console.log(`  provider floor: ${expensiveProduct.premiumPriceCents} cents (${expensiveProduct.provider})`);
console.log(`  deterministic distribution (n=${total}): ${JSON.stringify(Object.fromEntries([...distribution].sort((a, b) => a[0] - b[0])))}`);
