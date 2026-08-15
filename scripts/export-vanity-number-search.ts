/**
 * Run 5 sample area-code searches and export ALL results to JSON + CSV.
 * Usage: npx tsx scripts/export-vanity-number-search.ts
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import type { PremiumSearchResult, ScoredCandidate } from "../src/lib/premium-numbers/types";

const CASES = [
  { areaCode: "571", industry: "roofing", label: "571 · Northern VA roofing" },
  { areaCode: "540", industry: "lawn_care", label: "540 · VA lawn care" },
  { areaCode: "305", industry: "dental", label: "305 · Miami dental" },
  { areaCode: "404", industry: "legal", label: "404 · Atlanta legal" },
  { areaCode: "214", industry: "plumbing", label: "214 · Dallas plumbing" },
];

type ExportRow = ScoredCandidate & {
  rank: number;
  searchLabel: string;
  areaCode: string;
  industry: string;
  monthlyCost: string;
  upfrontCost: string;
  matchedWordsStr: string;
  matchedPatternsStr: string;
  businessReasonsStr: string;
  numberQualityReasonsStr: string;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function rowToCsv(row: ExportRow): string {
  return [
    row.rank,
    row.formattedNumber,
    row.phoneNumber,
    row.score,
    row.tier,
    row.businessMatchScore,
    row.numberQualityScore,
    row.areaCode,
    row.industry,
    row.searchLabel,
    row.matchedWordsStr,
    row.matchedPatternsStr,
    row.monthlyCost,
    row.upfrontCost,
    row.businessReasonsStr,
    row.numberQualityReasonsStr,
  ]
    .map((v) => csvEscape(String(v)))
    .join(",");
}

async function main() {
  const exportDir = path.join(process.cwd(), "exports");
  await mkdir(exportDir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(exportDir, `vanity-number-search-${timestamp}.json`);
  const csvPath = path.join(exportDir, `vanity-number-search-${timestamp}.csv`);

  const searchResults: PremiumSearchResult[] = [];
  const allRows: Omit<ExportRow, "rank">[] = [];

  for (const c of CASES) {
    console.log(`Searching ${c.label}…`);
    const result = await searchPremiumNumbers({
      areaCode: c.areaCode,
      industry: c.industry,
      limit: 500,
    });
    searchResults.push({ ...result, areaCode: c.areaCode, industry: c.industry } as PremiumSearchResult);

    for (const cand of result.candidates) {
      allRows.push({
        ...cand,
        searchLabel: c.label,
        areaCode: c.areaCode,
        industry: c.industry,
        monthlyCost: cand.telnyxCost?.monthlyCost ?? "",
        upfrontCost: cand.telnyxCost?.upfrontCost ?? "",
        matchedWordsStr: cand.matchedWords.join(", "),
        matchedPatternsStr: cand.matchedPatterns.join("; "),
        businessReasonsStr: cand.businessReasons
          .map((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.label}`)
          .join("; "),
        numberQualityReasonsStr: cand.numberQualityReasons
          .map((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.label}`)
          .join("; "),
      });
    }
  }

  // Dedupe by phone — keep highest score
  const byPhone = new Map<string, Omit<ExportRow, "rank">>();
  for (const row of allRows) {
    const existing = byPhone.get(row.phoneNumber);
    if (!existing || row.score > existing.score) byPhone.set(row.phoneNumber, row);
  }

  const ranked: ExportRow[] = [...byPhone.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.formattedNumber.localeCompare(b.formattedNumber);
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));

  const payload = {
    generatedAt: new Date().toISOString(),
    description:
      "Vanity Number Hunter — 70% business match + 30% number quality blend. Ranked by overall score.",
    searches: CASES.map((c) => ({
      areaCode: c.areaCode,
      industry: c.industry,
      label: c.label,
    })),
    searchSummaries: searchResults.map((r) => ({
      areaCode: r.areaCode,
      industry: r.industry,
      status: r.status,
      message: r.message,
      keywords: r.keywords.map((k) => `${k.word}=${k.digits}`),
      statistics: r.statistics,
    })),
    totalUniqueNumbers: ranked.length,
    numbers: ranked,
  };

  const csvHeader =
    "rank,formatted_number,e164,score,tier,business_match,number_quality,area_code,industry,search_label,matched_words,matched_patterns,monthly_cost,upfront_cost,business_reasons,number_quality_reasons";

  const csvBody = [csvHeader, ...ranked.map(rowToCsv)].join("\n");

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(csvPath, csvBody, "utf8");

  console.log("\nExport complete:");
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  Total unique numbers: ${ranked.length}`);
  console.log("\nTop 10:");
  ranked.slice(0, 10).forEach((r) => {
    console.log(`  ${r.rank}. ${r.formattedNumber}  ${r.score}/100  ${r.tier}  (${r.searchLabel})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
