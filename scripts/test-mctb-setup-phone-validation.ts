/**
 * Setup phone validation — stale ids rejected.
 * Run: npx tsx scripts/test-mctb-setup-phone-validation.ts
 */
import assert from "node:assert/strict";
import {
  isMctbSetupPhoneAccessible,
  sanitizeMctbSetupPhoneNumberId,
} from "../src/lib/mctb/setup-phone-validation";

const WS = "ws_1";
const PHONE_571 = "cmsgtjms84g6l2h0o255w1e3v";

async function main() {
  assert.equal(await isMctbSetupPhoneAccessible(WS, PHONE_571), true);
  assert.equal(await isMctbSetupPhoneAccessible(WS, "cmte8laci4o021u5q46723128_deleted"), false);
  assert.equal(
    await sanitizeMctbSetupPhoneNumberId(WS, "cmte8laci4o021u5q46723128_deleted"),
    null,
  );
  assert.equal(await sanitizeMctbSetupPhoneNumberId(WS, PHONE_571), PHONE_571);
  console.log("test-mctb-setup-phone-validation: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
