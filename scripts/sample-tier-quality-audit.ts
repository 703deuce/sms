/**
 * Manual tier-quality audit: sample numbers per personal price tier and inspect patterns.
 * Run: npx tsx scripts/sample-tier-quality-audit.ts
 */
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";
import { detectNumericPatterns } from "../src/lib/premium-numbers/pattern-detect";
import { quotePremiumPrice } from "../src/lib/premium-numbers/premium-pricing";

const areaCode = "571";

type AuditRow = {
  formatted: string;
  subscriber: string;
  price: number;
  nqScore: number;
  patterns: string[];
  label: string;
};

function scoreSub(subscriber: string): AuditRow | null {
  const c = scoreCandidate({
    phoneNumber: `+1${areaCode}${subscriber}`,
    keywords: [],
    searchContext: { mode: "personal", requestedAreaCodes: [areaCode] },
  });
  if (!c) return null;
  const q = quotePremiumPrice(c, "personal");
  const patterns = detectNumericPatterns(subscriber);
  return {
    formatted: c.formattedNumber,
    subscriber,
    price: q.premiumPriceCents,
    nqScore: c.numberQualityScore,
    patterns: patterns.map((p) => `${p.label} (${p.points}pts)`),
    label: q.displayLabel,
  };
}

let seed = 0x5eed1234;
const byTier = new Map<number, AuditRow[]>();

for (let i = 0; i < 20_000; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const subscriber = String(2_000_000 + (seed % 8_000_000));
  const row = scoreSub(subscriber);
  if (!row) continue;
  const list = byTier.get(row.price) ?? [];
  list.push(row);
  byTier.set(row.price, list);
}

function sample(tier: number, n: number): AuditRow[] {
  const list = byTier.get(tier) ?? [];
  const out: AuditRow[] = [];
  const used = new Set<number>();
  while (out.length < n && out.length < list.length) {
    const idx = Math.floor(Math.random() * list.length);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(list[idx]);
  }
  return out;
}

function patternBreakdown(list: AuditRow[]): Record<string, number> {
  const m = new Map<string, number>();
  for (const r of list) {
    const primary = r.patterns[0]?.split(" (")[0] ?? "no primary pattern";
    m.set(primary, (m.get(primary) ?? 0) + 1);
  }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

const tiers = [499, 799, 999, 1499, 1999, 2999, 3999];
for (const tier of tiers) {
  const count = byTier.get(tier)?.length ?? 0;
  const n = tier === 499 ? 60 : tier <= 1499 ? 15 : 8;
  console.log(`\n=== $${(tier / 100).toFixed(2)} (n=${count}) sample ${n} ===`);
  for (const row of sample(tier, n)) {
    const pat = row.patterns.length ? row.patterns.join("; ") : "no patterns";
    console.log(`${row.formatted} | nq=${row.nqScore} | ${pat}`);
  }
}

const p1499 = byTier.get(1499) ?? [];
const p999 = byTier.get(999) ?? [];
console.log(`\n=== $14.99 pattern breakdown (all ${p1499.length}) ===`);
console.log(JSON.stringify(patternBreakdown(p1499), null, 2));
console.log(`\n=== $9.99 pattern breakdown (all ${p999.length}) ===`);
console.log(JSON.stringify(patternBreakdown(p999), null, 2));

const p499 = byTier.get(499) ?? [];
const suspicious499 = p499.filter((r) => r.nqScore > 7 || r.patterns.length > 0);
console.log(
  `\n=== $4.99 with pattern or score>7: ${suspicious499.length} of ${p499.length} ===`,
);
for (const row of suspicious499.slice(0, 25)) {
  const pat = row.patterns.length ? row.patterns.join("; ") : "no patterns";
  console.log(`${row.formatted} | nq=${row.nqScore} | ${pat}`);
}

// User example numbers from spec (571 area code)
const examples = [
  "4836282", "2964881", "3645518",
  "4282727", "8812233",
  "4452525", "6833300",
  "6066600", "4881221",
];
console.log("\n=== User spec examples (571) ===");
for (const sub of examples) {
  const row = scoreSub(sub);
  if (!row) continue;
  const pat = row.patterns.length ? row.patterns.join("; ") : "no patterns";
  console.log(
    `${row.formatted} -> $${(row.price / 100).toFixed(2)} | nq=${row.nqScore} | ${pat}`,
  );
}
