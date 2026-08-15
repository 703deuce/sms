/**
 * Benchmark scores after 70/30 business-match blend tuning.
 * Run: npx tsx scripts/scoring-tuning-comparison.ts
 */
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";

const BENCHMARKS = [
  { formatted: "540-572-4444", e164: "+15405724444", industry: "lawn_care", monthly: "5" },
  { formatted: "571-240-1111", e164: "+15712401111", industry: "roofing", monthly: "5" },
  { formatted: "540-929-5296", e164: "+15409295296", industry: "lawn_care", monthly: "1" },
  { formatted: "571-680-7663", e164: "+15716807663", industry: "roofing", monthly: "1" },
  { formatted: "571-704-7663", e164: "+15717047663", industry: "roofing", monthly: "1" },
  { formatted: "540-296-6937", e164: "+15402966937", industry: "lawn_care", monthly: "1" },
  { formatted: "571-932-1212", e164: "+15719321212", industry: "roofing", monthly: "1" },
  { formatted: "540-655-1234", e164: "+15406551234", industry: "lawn_care", monthly: "1" },
  { formatted: "571-777-7663", e164: "+15717777663", industry: "roofing", monthly: "1" },
];

console.log("BENCHMARK SCORES (70% business + 30% number quality)\n");
console.log(
  "number".padEnd(16) +
    "overall".padEnd(8) +
    "tier".padEnd(12) +
    "BM".padEnd(6) +
    "NQ".padEnd(6) +
    "words",
);

for (const row of BENCHMARKS) {
  const keywords = buildKeywordEntries({ industry: row.industry });
  const c = scoreCandidate({
    phoneNumber: row.e164,
    keywords,
    telnyxCost: { monthlyCost: row.monthly },
  });
  if (!c) continue;
  console.log(
    `${row.formatted.padEnd(16)}${String(c.score).padEnd(8)}${c.tier.padEnd(12)}${String(c.businessMatchScore).padEnd(6)}${String(c.numberQualityScore).padEnd(6)}${c.matchedWords.join(", ")}`,
  );
}
