/**
 * 20–30 market vanity number batch + split export files.
 * Usage: npx tsx scripts/export-vanity-market-batch.ts
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { searchPremiumNumbers } from "../src/lib/premium-numbers/premium-number-search";
import {
  BUSINESS_MATCH_LIST_THRESHOLD,
  MEMORABLE_NUMBER_QUALITY_THRESHOLD,
} from "../src/lib/premium-numbers/scoring-config";
import { longestMatchedWordLength } from "../src/lib/premium-numbers/industry-keywords";
import type { PremiumSearchResult, ScoredCandidate } from "../src/lib/premium-numbers/types";

const MARKET_CASES = [
  { areaCode: "703", industry: "roofing", label: "703 · NoVA roofing" },
  { areaCode: "571", industry: "roofing", label: "571 · Northern VA roofing" },
  { areaCode: "540", industry: "lawn_care", label: "540 · VA lawn care" },
  { areaCode: "310", industry: "roofing", label: "310 · LA roofing" },
  { areaCode: "424", industry: "roofing", label: "424 · LA West roofing" },
  { areaCode: "305", industry: "dental", label: "305 · Miami dental" },
  { areaCode: "404", industry: "legal", label: "404 · Atlanta legal" },
  { areaCode: "214", industry: "plumbing", label: "214 · Dallas plumbing" },
  { areaCode: "602", industry: "hvac", label: "602 · Phoenix HVAC" },
  { areaCode: "813", industry: "junk_removal", label: "813 · Tampa junk removal" },
  { areaCode: "512", industry: "moving", label: "512 · Austin moving" },
  { areaCode: "615", industry: "plumbing", label: "615 · Nashville plumbing" },
  { areaCode: "720", industry: "roofing", label: "720 · Denver roofing" },
  { areaCode: "312", industry: "plumbing", label: "312 · Chicago plumbing" },
  { areaCode: "770", industry: "roofing", label: "770 · Atlanta roofing" },
  { areaCode: "561", industry: "lawn_care", label: "561 · Palm Beach lawn care" },
  { areaCode: "916", industry: "hvac", label: "916 · Sacramento HVAC" },
  { areaCode: "480", industry: "roofing", label: "480 · Phoenix roofing" },
  { areaCode: "617", industry: "dental", label: "617 · Boston dental" },
  { areaCode: "206", industry: "plumbing", label: "206 · Seattle plumbing" },
  { areaCode: "713", industry: "hvac", label: "713 · Houston HVAC" },
  { areaCode: "858", industry: "dental", label: "858 · San Diego dental" },
  { areaCode: "502", industry: "lawn_care", label: "502 · Kentucky lawn care" },
  { areaCode: "571", industry: "plumbing", label: "571 · NoVA plumbing" },
  { areaCode: "303", industry: "roofing", label: "303 · Denver roofing" },
  { areaCode: "407", industry: "lawn_care", label: "407 · Orlando lawn care" },
  { areaCode: "704", industry: "roofing", label: "704 · Charlotte roofing" },
  { areaCode: "919", industry: "legal", label: "919 · Raleigh legal" },
];

type ExportRow = ScoredCandidate & {
  rank: number;
  listSection: "business_match" | "memorable_alternative" | "other";
  searchLabel: string;
  areaCode: string;
  industry: string;
  longestWordLength: number;
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
    row.listSection,
    row.formattedNumber,
    row.phoneNumber,
    row.score,
    row.tier,
    row.businessMatchScore,
    row.numberQualityScore,
    row.longestWordLength,
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

function classifyRow(row: Omit<ExportRow, "rank" | "listSection">): ExportRow["listSection"] {
  if (row.businessMatchScore >= BUSINESS_MATCH_LIST_THRESHOLD) return "business_match";
  if (row.numberQualityScore >= MEMORABLE_NUMBER_QUALITY_THRESHOLD) {
    return "memorable_alternative";
  }
  return "other";
}

const CSV_HEADER =
  "rank,section,formatted_number,e164,score,tier,business_match,number_quality,longest_word_len,area_code,industry,search_label,matched_words,matched_patterns,monthly_cost,upfront_cost,business_reasons,number_quality_reasons";

function writeTxtSection(
  lines: string[],
  title: string,
  rows: ExportRow[],
) {
  lines.push(title);
  lines.push("=".repeat(title.length));
  if (!rows.length) {
    lines.push("(none)\n");
    return;
  }
  for (const r of rows) {
    lines.push(
      `${r.rank}. ${r.formattedNumber}  ${r.score}/100 ${r.tier}  BM ${r.businessMatchScore} NQ ${r.numberQualityScore}`,
    );
    lines.push(`   Search: ${r.searchLabel}`);
    if (r.matchedWordsStr) lines.push(`   Words: ${r.matchedWordsStr} (longest ${r.longestWordLength} letters)`);
    if (r.matchedPatternsStr) lines.push(`   Patterns: ${r.matchedPatternsStr}`);
    lines.push("");
  }
}

async function main() {
  const exportDir = path.join(process.cwd(), "exports");
  await mkdir(exportDir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `vanity-market-search-${stamp}`;
  const jsonPath = path.join(exportDir, `${base}.json`);
  const csvAllPath = path.join(exportDir, `${base}-all.csv`);
  const csvBusinessPath = path.join(exportDir, `${base}-business-matches.csv`);
  const csvMemorablePath = path.join(exportDir, `${base}-memorable-alternatives.csv`);
  const txtPath = path.join(exportDir, `${base}.txt`);

  const searchResults: PremiumSearchResult[] = [];
  const allRows: Omit<ExportRow, "rank" | "listSection">[] = [];

  for (const c of MARKET_CASES) {
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
        longestWordLength: longestMatchedWordLength(cand.matchedWords, result.keywords),
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

  const byPhone = new Map<string, Omit<ExportRow, "rank" | "listSection">>();
  for (const row of allRows) {
    const existing = byPhone.get(row.phoneNumber);
    if (!existing || row.score > existing.score) byPhone.set(row.phoneNumber, row);
  }

  const ranked: ExportRow[] = [...byPhone.values()]
    .map((row) => ({
      ...row,
      listSection: classifyRow(row),
      rank: 0,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.businessMatchScore !== a.businessMatchScore) {
        return b.businessMatchScore - a.businessMatchScore;
      }
      return a.formattedNumber.localeCompare(b.formattedNumber);
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));

  const businessMatches = ranked
    .filter((r) => r.listSection === "business_match")
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const memorableAlternatives = ranked
    .filter((r) => r.listSection === "memorable_alternative")
    .sort((a, b) => b.numberQualityScore - a.numberQualityScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const wordLengthHits = {
    fourLetterPlus: businessMatches.filter((r) => r.longestWordLength >= 4).length,
    fiveLetterPlus: businessMatches.filter((r) => r.longestWordLength >= 5).length,
    sixLetterPlus: businessMatches.filter((r) => r.longestWordLength >= 6).length,
    sevenLetter: businessMatches.filter((r) => r.longestWordLength >= 7).length,
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    description:
      "Market batch — 70% business match + 30% number quality. Split: business matches vs memorable alternatives.",
    thresholds: {
      businessMatchList: BUSINESS_MATCH_LIST_THRESHOLD,
      memorableNumberQuality: MEMORABLE_NUMBER_QUALITY_THRESHOLD,
    },
    searches: MARKET_CASES,
    searchSummaries: searchResults.map((r) => ({
      areaCode: r.areaCode,
      industry: r.industry,
      status: r.status,
      keywords: r.keywords.map((k) => `${k.word}=${k.digits} (${k.word.length} letters)`),
      statistics: r.statistics,
      businessMatchesInSearch: r.candidates.filter(
        (c) => c.businessMatchScore >= BUSINESS_MATCH_LIST_THRESHOLD,
      ).length,
    })),
    summary: {
      totalUniqueNumbers: ranked.length,
      businessMatches: businessMatches.length,
      memorableAlternatives: memorableAlternatives.length,
      wordLengthHits,
    },
    bestMatchesForYourBusiness: businessMatches,
    otherMemorableNumbers: memorableAlternatives,
    allNumbers: ranked,
  };

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(csvAllPath, [CSV_HEADER, ...ranked.map(rowToCsv)].join("\n"), "utf8");
  await writeFile(
    csvBusinessPath,
    [CSV_HEADER, ...businessMatches.map(rowToCsv)].join("\n"),
    "utf8",
  );
  await writeFile(
    csvMemorablePath,
    [CSV_HEADER, ...memorableAlternatives.map(rowToCsv)].join("\n"),
    "utf8",
  );

  const txtLines: string[] = [
    `VANITY MARKET SEARCH — ${stamp}`,
    `Generated: ${payload.generatedAt}`,
    `Total unique: ${ranked.length}`,
    `Business matches (BM>=${BUSINESS_MATCH_LIST_THRESHOLD}): ${businessMatches.length}`,
    `Memorable alternatives (NQ>=${MEMORABLE_NUMBER_QUALITY_THRESHOLD}, low BM): ${memorableAlternatives.length}`,
    `Word hits — 4+ letters: ${wordLengthHits.fourLetterPlus}, 5+: ${wordLengthHits.fiveLetterPlus}, 6+: ${wordLengthHits.sixLetterPlus}, 7: ${wordLengthHits.sevenLetter}`,
    "",
  ];
  writeTxtSection(txtLines, "BEST MATCHES FOR YOUR BUSINESS", businessMatches.slice(0, 100));
  writeTxtSection(txtLines, "OTHER MEMORABLE NUMBERS", memorableAlternatives.slice(0, 100));
  await writeFile(txtPath, txtLines.join("\n"), "utf8");

  console.log("\nExport complete:");
  console.log(`  JSON:     ${jsonPath}`);
  console.log(`  TXT:      ${txtPath}`);
  console.log(`  CSV all:  ${csvAllPath}`);
  console.log(`  CSV biz:  ${csvBusinessPath}`);
  console.log(`  CSV alt:  ${csvMemorablePath}`);
  console.log(`  Business matches: ${businessMatches.length}`);
  console.log(`  Memorable alts:   ${memorableAlternatives.length}`);
  console.log("\nTop business matches:");
  businessMatches.slice(0, 15).forEach((r) => {
    console.log(
      `  ${r.rank}. ${r.formattedNumber}  ${r.score} BM${r.businessMatchScore}  ${r.matchedWordsStr}`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
