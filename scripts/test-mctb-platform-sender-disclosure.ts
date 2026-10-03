/**
 * Unit checks for platform-sender first-message consumer disclosure (no DB).
 * Run: npx tsx scripts/test-mctb-platform-sender-disclosure.ts
 */
import {
  applyPlatformSenderFirstMessageDisclosure,
  messageAlreadyHasPlatformDisclosure,
} from "../src/lib/mctb/messaging/platform-sender-consumer-disclosure";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const base = "Sorry we missed your call! How can we help?";
const disclosed = applyPlatformSenderFirstMessageDisclosure(base);
assert(/via\s+transovo/i.test(disclosed), "includes via Transovo");
assert(/\bSTOP\b/i.test(disclosed), "includes STOP");
assert(/\bHELP\b/i.test(disclosed), "includes HELP");
assert(messageAlreadyHasPlatformDisclosure(disclosed), "detects full disclosure");
assert(
  applyPlatformSenderFirstMessageDisclosure(disclosed) === disclosed,
  "idempotent when already disclosed",
);

const followUp = applyPlatformSenderFirstMessageDisclosure("Thanks for texting back!");
assert(messageAlreadyHasPlatformDisclosure(followUp), "standalone message gets full disclosure");

console.log("PASS platform-sender consumer disclosure");
