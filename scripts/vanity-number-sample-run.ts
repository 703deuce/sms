/**
 * One-off sample run: 5 area codes × industries, merge + rank globally.
 * Usage: npx tsx scripts/vanity-number-sample-run.ts
 */
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import type { ScoredCandidate } from "../src/lib/premium-numbers/types";

const CASES = [
  { areaCode: "571", industry: "roofing", label: "571 · Northern VA roofing" },
  { areaCode: "540", industry: "lawn_care", label: "540 · VA lawn care" },
  { areaCode: "305", industry: "dental", label: "305 · Miami dental" },
  { areaCode: "404", industry: "legal", label: "404 · Atlanta legal" },
  { areaCode: "214", industry: "plumbing", label: "214 · Dallas plumbing" },
];

type Row = ScoredCandidate & { searchLabel: string; areaCode: string; industry: string };

async function main() {
  const all: Row[] = [];

  for (const c of CASES) {
    console.log(`\n--- ${c.label} ---`);
    const result = await searchPremiumNumbers({
      areaCode: c.areaCode,
      industry: c.industry,
      limit: 100,
    });
    console.log(
      `Status: ${result.status} · unique: ${result.statistics.uniqueCandidates} · searches: ${result.statistics.telnyxSearchesAttempted}`,
    );
    for (const cand of result.candidates) {
      all.push({
        ...cand,
        searchLabel: c.label,
        areaCode: c.areaCode,
        industry: c.industry,
      });
    }
  }

  const byPhone = new Map<string, Row>();
  for (const row of all) {
    const existing = byPhone.get(row.phoneNumber);
    if (!existing || row.score > existing.score) byPhone.set(row.phoneNumber, row);
  }

  const ranked = [...byPhone.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.formattedNumber.localeCompare(b.formattedNumber);
  });

  console.log("\n\n========== GLOBAL TOP 25 (all sample searches) ==========\n");
  ranked.slice(0, 25).forEach((r, i) => {
    const cost = r.telnyxCost?.monthlyCost
      ? `$${r.telnyxCost.monthlyCost}/mo`
      : "—";
    console.log(`${i + 1}. ${r.formattedNumber}  ${r.score}/100  ${r.tier.toUpperCase()}  ${cost}`);
    console.log(`   Search: ${r.searchLabel}`);
    if (r.matchedWords.length) console.log(`   Words: ${r.matchedWords.join(", ")}`);
    if (r.matchedPatterns.length) console.log(`   Patterns: ${r.matchedPatterns.slice(0, 2).join("; ")}`);
    const topReasons = r.reasons.filter((x) => x.points >= 10).slice(0, 4);
    if (topReasons.length) {
      console.log(
        `   Why: ${topReasons.map((x) => `${x.points > 0 ? "+" : ""}${x.points} ${x.label}`).join("; ")}`,
      );
    }
    console.log("");
  });

  console.log("========== SUMMARY BY SEARCH ==========");
  for (const c of CASES) {
    const subset = ranked.filter((r) => r.areaCode === c.areaCode);
    const top = subset[0];
    console.log(
      `${c.label}: status candidates=${subset.length} best=${top ? `${top.formattedNumber} (${top.score})` : "none"}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
