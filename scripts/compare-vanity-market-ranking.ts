/**
 * Re-score prior market export rows with the new engine (no Telnyx).
 * Run: npx tsx scripts/compare-vanity-market-ranking.ts
 */
import { readFileSync } from "node:fs";
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";

const CSV_PATH = "exports/vanity-market-search-2026-08-15-all.csv";

type Row = {
  formatted: string;
  e164: string;
  industry: string;
  oldScore: number;
  oldBm: number;
  oldNq: number;
};

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, "utf8");
  const lines = text.trim().split("\n").slice(1);
  return lines.map((line) => {
    const cols = line.split(",");
    return {
      formatted: cols[2],
      e164: cols[3],
      industry: cols[10] ?? "lawn_care",
      oldScore: Number(cols[5]),
      oldBm: Number(cols[6]),
      oldNq: Number(cols[7]),
    };
  });
}

const rows = parseCsv(CSV_PATH);
const rescored = rows.map((row) => {
  const area = row.e164.replace(/\D/g, "").slice(1, 4);
  const keywords = buildKeywordEntries({ industry: row.industry });
  const c = scoreCandidate({
    phoneNumber: row.e164,
    keywords,
    searchContext: { requestedAreaCodes: [area], industry: row.industry },
  });
  return {
    ...row,
    newScore: c?.score ?? 0,
    newBm: c?.businessMatchScore ?? 0,
    newNq: c?.numberQualityScore ?? 0,
    newCs: c?.commercialSemanticScore ?? 0,
    nqLabel: c?.numberQualityLabel ?? "",
  };
});

const oldTop = [...rescored].sort((a, b) => b.oldScore - a.oldScore).slice(0, 50);
const newTop = [...rescored].sort((a, b) => b.newScore - a.newScore).slice(0, 50);

const oldSet = new Set(oldTop.map((r) => r.e164));
const newSet = new Set(newTop.map((r) => r.e164));
const overlap = [...oldSet].filter((e) => newSet.has(e)).length;

console.log("MARKET RE-RANK COMPARISON (top 50 from prior export)\n");
console.log(`Rows rescored: ${rescored.length}`);
console.log(`Top-50 overlap: ${overlap}/50`);
console.log("\nNEW TOP 15:");
for (const r of newTop.slice(0, 15)) {
  console.log(
    `${r.formatted.padEnd(16)} score ${String(r.newScore).padEnd(4)} BM ${String(r.newBm).padEnd(4)} NQ ${String(r.newNq).padEnd(4)} CS ${r.newCs} (${r.nqLabel})`,
  );
}

console.log("\nBIGGEST SCORE GAINS (intrinsic NQ):");
const nqGains = [...rescored]
  .map((r) => ({ ...r, nqDelta: r.newNq - r.oldNq }))
  .sort((a, b) => b.nqDelta - a.nqDelta)
  .slice(0, 8);
for (const r of nqGains) {
  console.log(`${r.formatted}: NQ ${r.oldNq} -> ${r.newNq} (+${r.nqDelta})`);
}

console.log("\nBIGGEST BUSINESS MATCH GAINS:");
const bmGains = [...rescored]
  .map((r) => ({ ...r, bmDelta: r.newBm - r.oldBm }))
  .sort((a, b) => b.bmDelta - a.bmDelta)
  .slice(0, 8);
for (const r of bmGains) {
  console.log(`${r.formatted}: BM ${r.oldBm} -> ${r.newBm} (+${r.bmDelta})`);
}
