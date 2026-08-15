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
  const c = scoreCandidate({
    phoneNumber: `+1703${subscriber}`,
    keywords,
    telnyxCost: monthlyCost ? { monthlyCost } : undefined,
  });
  assert(c !== null, "expected score");
  return c!;
}

assert(wordToKeypadDigits("ROOF") === "7663");
assert(wordToKeypadDigits("MOVERS") === "668377");

const plain1111 = scoreSub("2401111", "roofing", "5");
const roof777 = scoreSub("7777663", "roofing", "1");
const roof704 = scoreSub("7047663", "roofing", "1");
const lawn5296 = scoreSub("9295296", "lawn_care", "1");
const mower = scoreSub("2966937", "lawn_care", "1");
const repeater4444 = scoreSub("5724444", "lawn_care", "5");
const abab = scoreSub("9321212", "roofing", "1");

assert(plain1111.score < mower.score, "MOWER should beat plain 1111 repeater");
assert(mower.score > lawn5296.score, "MOWER should beat LAWN for lawn care");
assert(lawn5296.score > repeater4444.score, "LAWN should beat 4444 repeater for lawn care");
assert(roof777.score > plain1111.score, "777-ROOF should beat plain 1111");
assert(roof777.score > roof704.score, "777-ROOF should beat plain ROOF ending");
assert(roof704.businessMatchScore >= 60, "4-digit ROOF business match should be strong");

assert(mower.businessMatchScore > lawn5296.businessMatchScore, "MOWER BM > LAWN BM");
assert(repeater4444.businessMatchScore < 10, "4444 should have near-zero business match");

const weakMow = scoreSub("6988669", "lawn_care", "1");
assert(weakMow.businessMatchScore < 40, "3-digit MOW should be weak business match");

const a = scoreSub("7777663");
const b = scoreSub("7777663");
assert(a.score === b.score, "deterministic");

console.log("vanity-number-scoring tests passed");
console.log(`  571-240-1111 => ${plain1111.score} (BM ${plain1111.businessMatchScore} / NQ ${plain1111.numberQualityScore})`);
console.log(`  540-296-MOWER => ${mower.score} (BM ${mower.businessMatchScore} / NQ ${mower.numberQualityScore})`);
console.log(`  540-929-LAWN => ${lawn5296.score} (BM ${lawn5296.businessMatchScore} / NQ ${lawn5296.numberQualityScore})`);
console.log(`  540-572-4444 => ${repeater4444.score} (BM ${repeater4444.businessMatchScore} / NQ ${repeater4444.numberQualityScore})`);
console.log(`  571-777-ROOF => ${roof777.score} (BM ${roof777.businessMatchScore} / NQ ${roof777.numberQualityScore})`);
