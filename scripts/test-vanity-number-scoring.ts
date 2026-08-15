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

function scoreSub(subscriber: string, industry = "roofing") {
  const keywords = buildKeywordEntries({ industry });
  const phone = `+1703${subscriber}`;
  const c = scoreCandidate({
    phoneNumber: phone,
    keywords,
  });
  assert(c !== null, "expected score");
  return c!;
}

// Keypad conversion
assert(wordToKeypadDigits("ROOF") === "7663", "ROOF -> 7663");
assert(wordToKeypadDigits("LAWN") === "5296", "LAWN -> 5296");
assert(wordToKeypadDigits("JUNK") === "5865", "JUNK -> 5865");
assert(wordToKeypadDigits("MOVERS") === "668377", "MOVERS -> 668377");

// Ranking comparisons (roofing)
const roof777 = scoreSub("7777663");
const roof583 = scoreSub("5837663");
const random = scoreSub("5839281");
const repeating = scoreSub("4444444");

assert(roof777.score > roof583.score, "703-777-7663 should beat 703-583-7663");
assert(roof583.score > random.score, "703-583-7663 should beat random");
assert(repeating.score >= 80, "703-444-4444 should score very high");

// Determinism
const a = scoreSub("7777663");
const b = scoreSub("7777663");
assert(a.score === b.score, "scoring must be deterministic");

console.log("vanity-number-scoring tests passed");
console.log(`  703-777-7663 => ${roof777.score} (${roof777.tier})`);
console.log(`  703-583-7663 => ${roof583.score} (${roof583.tier})`);
console.log(`  703-583-9281 => ${random.score} (${random.tier})`);
console.log(`  703-444-4444 => ${repeating.score} (${repeating.tier})`);
