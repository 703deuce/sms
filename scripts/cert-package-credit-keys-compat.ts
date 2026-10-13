/**
 * Phase 0 / 1a gate — package credit key mint + redeem backward compatibility (no DB).
 * Run: npx tsx scripts/cert-package-credit-keys-compat.ts
 */
import {
  creditKeyForBookingType,
  creditKeyForClassSeries,
  mintRemainingCreditsFromRules,
  resolveBookingCreditKey,
  resolveClassSeriesCreditKey,
  PACKAGE_CREDIT_KEY_DEFAULT,
} from "../src/lib/appointments/service-booking/package-credit-keys";

type Case = { name: string; run: () => void };

const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg);
}

const cases: Case[] = [
  {
    name: "mint itemized service + class",
    run: () => {
      const minted = mintRemainingCreditsFromRules([
        { bookingTypeId: "svc-a", quantity: 3, label: "Service" },
        { classSeriesId: "cls-b", quantity: 1, label: "Class" },
      ]);
      assert(minted[creditKeyForBookingType("svc-a")] === 3, "service qty");
      assert(minted[creditKeyForClassSeries("cls-b")] === 1, "class qty");
    },
  },
  {
    name: "legacy bare bookingTypeId still redeems",
    run: () => {
      const legacy = { "type-old": 2 };
      const key = resolveBookingCreditKey(legacy, "type-old");
      assert(key === "type-old", "legacy bare id");
    },
  },
  {
    name: "canonical type: prefix preferred over legacy",
    run: () => {
      const both = {
        [creditKeyForBookingType("t1")]: 1,
        t1: 5,
      };
      const key = resolveBookingCreditKey(both, "t1");
      assert(key === creditKeyForBookingType("t1"), "prefer canonical");
    },
  },
  {
    name: "pooled default bucket redeems any service",
    run: () => {
      const pooled = { [PACKAGE_CREDIT_KEY_DEFAULT]: 4 };
      const key = resolveBookingCreditKey(pooled, "any-type");
      assert(key === PACKAGE_CREDIT_KEY_DEFAULT, "default pool");
    },
  },
  {
    name: "class series canonical + legacy",
    run: () => {
      const canonical = { [creditKeyForClassSeries("s1")]: 1 };
      assert(resolveClassSeriesCreditKey(canonical, "s1") === creditKeyForClassSeries("s1"), "series canonical");
      const legacy = { s1: 1 };
      assert(resolveClassSeriesCreditKey(legacy, "s1") === "s1", "series legacy");
    },
  },
  {
    name: "itemized class does not drain unrelated pooled default incorrectly",
    run: () => {
      const itemized = { [creditKeyForClassSeries("only")]: 1 };
      const key = resolveBookingCreditKey(itemized, "other-service");
      assert(key === null, "no cross-redeem");
    },
  },
];

for (const c of cases) {
  try {
    c.run();
    console.log(`PASS ${c.name}`);
  } catch (e) {
    failures.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    console.log(`FAIL ${c.name}`);
  }
}

if (failures.length) {
  console.error("\nCERT FAILED");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log("\nCERT PASS — package credit key compatibility");
