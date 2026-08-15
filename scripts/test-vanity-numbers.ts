/**
 * Live Telnyx vanity number search CLI (read-only — does not purchase).
 *
 * Usage:
 *   npm run test:vanity-numbers -- --area-code 703 --industry roofing
 *   npm run test:vanity-numbers -- --area-code 540 --industry lawn_care
 *   npm run test:vanity-numbers -- --batch
 */
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import type { PremiumSearchResult } from "../src/lib/premium-numbers/types";

function parseArgs(argv: string[]) {
  const out: {
    areaCode?: string;
    industry?: string;
    keywords?: string[];
    limit?: number;
    batch?: boolean;
  } = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--batch") out.batch = true;
    else if (arg === "--area-code" && argv[i + 1]) out.areaCode = argv[++i];
    else if (arg === "--industry" && argv[i + 1]) out.industry = argv[++i];
    else if (arg === "--keywords" && argv[i + 1]) {
      out.keywords = argv[++i].split(",").map((k) => k.trim()).filter(Boolean);
    } else if (arg === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
  }
  return out;
}

const BATCH_CASES: Array<{ areaCode: string; industry: string }> = [
  { areaCode: "703", industry: "roofing" },
  { areaCode: "571", industry: "roofing" },
  { areaCode: "540", industry: "lawn_care" },
  { areaCode: "310", industry: "roofing" },
  { areaCode: "424", industry: "roofing" },
  { areaCode: "305", industry: "dental" },
  { areaCode: "404", industry: "legal" },
  { areaCode: "214", industry: "plumbing" },
  { areaCode: "602", industry: "hvac" },
  { areaCode: "813", industry: "junk_removal" },
];

function printResult(result: PremiumSearchResult) {
  console.log(`\nSearching ${result.areaCode} for ${result.industry || "—"}…`);
  console.log(`Status: ${result.status}`);
  if (result.message) console.log(`Message: ${result.message}`);

  console.log("Keywords:");
  for (const k of result.keywords) {
    console.log(`  ${k.word} = ${k.digits}`);
  }

  console.log(
    `Telnyx searches executed: ${result.statistics.telnyxSearchesAttempted} (${result.statistics.telnyxSearchesSucceeded} ok, ${result.statistics.telnyxSearchesFailed} failed)`,
  );
  console.log(`Unique numbers examined: ${result.statistics.uniqueCandidates}`);

  const top = result.candidates.slice(0, 10);
  if (top.length) {
    console.log("TOP RESULTS");
    top.forEach((c, i) => {
      console.log(`${i + 1}. ${c.formattedNumber}`);
      console.log(`   ${c.score}/100 ${c.tier.toUpperCase()}`);
      if (c.matchedWords.length) console.log(`   ${c.matchedWords.join(", ")}`);
      const summary = c.matchedPatterns.slice(0, 2).join(" · ");
      if (summary) console.log(`   ${summary}`);
    });
  } else {
    console.log("No scored candidates in top results.");
  }

  console.log("Scores:");
  const tiers = result.statistics.tierCounts;
  console.log(`  Exceptional: ${tiers.Exceptional}`);
  console.log(`  Premium: ${tiers.Premium}`);
  console.log(`  Excellent: ${tiers.Excellent}`);
  console.log(`  Good: ${tiers.Good}`);
  console.log(`  Nice: ${tiers.Nice}`);
  console.log(`  Ordinary: ${tiers.Ordinary}`);
  console.log(
    `  60+: ${result.statistics.scored60Plus} · 70+: ${result.statistics.scored70Plus} · 80+: ${result.statistics.scored80Plus} · 90+: ${result.statistics.scored90Plus}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.batch) {
    for (const row of BATCH_CASES) {
      const result = await searchPremiumNumbers({
        areaCode: row.areaCode,
        industry: row.industry,
        limit: 15,
      });
      printResult(result);
    }
    return;
  }

  if (!args.areaCode) {
    console.error("Provide --area-code or --batch");
    process.exit(1);
  }

  const result = await searchPremiumNumbers({
    areaCode: args.areaCode,
    industry: args.industry,
    customKeywords: args.keywords,
    limit: args.limit ?? 25,
  });
  printResult(result);

  if (result.status === "TELNYX_ERROR" || result.status === "NOT_CONFIGURED") {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
