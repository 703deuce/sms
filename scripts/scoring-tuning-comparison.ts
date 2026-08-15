/**
 * Before/after scoring comparison for tuned weights.
 * Run: npx tsx scripts/scoring-tuning-comparison.ts
 */
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";

const BEFORE: Record<string, { score: number; tier: string }> = {
  "540-572-4444": { score: 100, tier: "Exceptional" },
  "571-240-1111": { score: 100, tier: "Exceptional" },
  "540-929-5296": { score: 38, tier: "Ordinary" },
  "571-680-7663": { score: 38, tier: "Ordinary" },
  "571-704-7663": { score: 38, tier: "Ordinary" },
  "540-296-6937": { score: 41, tier: "Ordinary" },
  "571-932-1212": { score: 45, tier: "Ordinary" },
  "540-655-1234": { score: 25, tier: "Ordinary" },
};

const CASES = [
  { formatted: "540-572-4444", e164: "+15405724444", industry: "lawn_care", monthly: "5" },
  { formatted: "571-240-1111", e164: "+15712401111", industry: "roofing", monthly: "5" },
  { formatted: "540-929-5296", e164: "+15409295296", industry: "lawn_care", monthly: "1" },
  { formatted: "571-680-7663", e164: "+15716807663", industry: "roofing", monthly: "1" },
  { formatted: "571-704-7663", e164: "+15717047663", industry: "roofing", monthly: "1" },
  { formatted: "540-296-6937", e164: "+15402966937", industry: "lawn_care", monthly: "1" },
  { formatted: "571-932-1212", e164: "+15719321212", industry: "roofing", monthly: "1" },
  { formatted: "540-655-1234", e164: "+15406551234", industry: "lawn_care", monthly: "1" },
];

console.log("SCORING TUNING — BEFORE vs AFTER\n");
console.log(
  "formatted".padEnd(16) +
    "before".padEnd(22) +
    "after".padEnd(22) +
    "delta".padEnd(8) +
    "words",
);
console.log("-".repeat(80));

for (const row of CASES) {
  const keywords = buildKeywordEntries({ industry: row.industry });
  const after = scoreCandidate({
    phoneNumber: row.e164,
    keywords,
    telnyxCost: { monthlyCost: row.monthly },
  });
  const before = BEFORE[row.formatted];
  const delta = after ? after.score - before.score : 0;
  const sign = delta >= 0 ? "+" : "";
  console.log(
    `${row.formatted.padEnd(16)}${before.score} ${before.tier.padEnd(14)}${after?.score ?? "—"} ${(after?.tier ?? "").padEnd(14)}${sign}${delta}`.padEnd(8) +
      (after?.matchedWords.join(", ") || ""),
  );
  if (after) {
    const top = after.reasons
      .filter((r) => Math.abs(r.points) >= 10)
      .map((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.label}`)
      .join("; ");
    console.log(`  → ${top}`);
  }
  console.log("");
}
