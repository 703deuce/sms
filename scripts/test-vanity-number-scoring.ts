/**
 * Unit tests for vanity number keypad + scoring (no Telnyx network).
 * Run: npm run test:vanity-number-scoring
 */
import { wordToKeypadDigits } from "../src/lib/premium-numbers/keypad";
import { buildKeywordEntries } from "../src/lib/premium-numbers/industry-keywords";
import { scoreCandidate } from "../src/lib/premium-numbers/scoring";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function scoreSub(
  subscriber: string,
  industry = "roofing",
  monthlyCost?: string,
) {
  const keywords = buildKeywordEntries({ industry });
  const phone = `+1703${subscriber}`;
  const c = scoreCandidate({
    phoneNumber: phone,
    keywords,
    telnyxCost: monthlyCost ? { monthlyCost } : undefined,
  });
  assert(c !== null, "expected score");
  return c!;
}

// Keypad conversion
assert(wordToKeypadDigits("ROOF") === "7663", "ROOF -> 7663");
assert(wordToKeypadDigits("LAWN") === "5296", "LAWN -> 5296");
assert(wordToKeypadDigits("JUNK") === "5865", "JUNK -> 5865");
assert(wordToKeypadDigits("MOVERS") === "668377", "MOVERS -> 668377");

// Pattern stacking: 1111 should not score 100 from overlapping bonuses
const plain1111 = scoreSub("2401111", "roofing", "5");
assert(plain1111.score < 70, "1111 repeater should not auto-score 100");
assert(plain1111.score >= 45, "1111 should still be a nice repeater");

// Industry words should score well
const roof704 = scoreSub("7047663", "roofing", "1");
assert(roof704.score >= 70, "703-704-7663 ROOF should be Excellent+");
assert(roof704.tier !== "Ordinary", "ROOF ending should not be Ordinary");

const lawn5296 = scoreSub("9295296", "lawn_care", "1");
assert(lawn5296.score >= 70, "LAWN ending should be Excellent+");

const mower = scoreSub("2966937", "lawn_care", "1");
assert(mower.score >= 70, "MOWER 5-digit ending should score well");
assert(mower.matchedWords.includes("MOWER"), "should match MOWER at end");

// 777-ROOF should beat plain 1111 repeater
const roof777 = scoreSub("7777663", "roofing", "1");
assert(roof777.score > plain1111.score, "777-ROOF should beat plain 1111 repeater");

// Repeating full subscriber
const repeating = scoreSub("4444444", "roofing");
assert(repeating.score >= 80, "703-444-4444 should score very high");

// 1212 should be Nice or better
const abab = scoreSub("9321212", "roofing", "1");
assert(abab.score >= 35, "1212 should be Nice tier or better");
assert(abab.tier !== "Ordinary", "1212 should not be Ordinary");

// Determinism
const a = scoreSub("7777663");
const b = scoreSub("7777663");
assert(a.score === b.score, "scoring must be deterministic");

console.log("vanity-number-scoring tests passed");
console.log(`  703-240-1111 => ${plain1111.score} (${plain1111.tier})`);
console.log(`  703-777-7663 => ${roof777.score} (${roof777.tier})`);
console.log(`  703-704-7663 => ${roof704.score} (${roof704.tier})`);
console.log(`  703-929-5296 LAWN => ${lawn5296.score} (${lawn5296.tier})`);
console.log(`  703-296-6937 MOWER => ${mower.score} (${mower.tier})`);
console.log(`  703-932-1212 => ${abab.score} (${abab.tier})`);
console.log(`  703-444-4444 => ${repeating.score} (${repeating.tier})`);
