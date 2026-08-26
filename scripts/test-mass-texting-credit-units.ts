/**
 * Mass Texting unit certification: credits, personalization, CSV, A2P inference.
 * Run: npx tsx scripts/test-mass-texting-credit-units.ts
 */
import assert from "node:assert/strict";
import { estimateSmsSegments } from "../src/lib/utils";
import {
  creditsForRenderedMessage,
  MASS_TEXT_MMS_CREDIT_MULTIPLIER,
} from "../src/lib/mass-texting/pricing";
import {
  creditsForRecipientBody,
  massTextMergeVarsFromContact,
  renderMassTextBody,
} from "../src/lib/mass-texting/personalization";
import { parseCsv } from "../src/lib/contacts/parse-csv";
import { inferInboundProductSource } from "../src/lib/mass-texting/product-source";
import { getCampaignCategory } from "../src/lib/campaigns/catalog";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

const gsm160 = "a".repeat(160);
assert.equal(estimateSmsSegments(gsm160).segments, 1);
assert.equal(estimateSmsSegments(gsm160 + "b").segments, 2);
assert.equal(estimateSmsSegments("a".repeat(153 * 2)).segments, 2);
assert.equal(estimateSmsSegments("a".repeat(153 * 2 + 1)).segments, 3);

const unicode70 = "é".repeat(70);
assert.equal(estimateSmsSegments(unicode70).segments, 1);
assert.equal(estimateSmsSegments(unicode70 + "é").segments, 2);

const short = creditsForRecipientBody({
  template: "Hi {{first_name}}",
  isMms: false,
  vars: massTextMergeVarsFromContact({ firstName: "Amy" }),
});
assert.equal(short.credits, 1);
assert.equal(short.body.includes("Amy"), true);
assert.equal(short.body.includes("{{"), false);

const longName = creditsForRecipientBody({
  template: `Hi {{first_name}}, ${"x".repeat(150)}`,
  isMms: false,
  vars: massTextMergeVarsFromContact({ firstName: "Ann" }),
});
const longerName = creditsForRecipientBody({
  template: `Hi {{first_name}}, ${"x".repeat(150)}`,
  isMms: false,
  vars: massTextMergeVarsFromContact({ firstName: "Alexandria-Maximilienne" }),
});
assert.equal(longName.credits, 1);
assert.ok(longerName.credits >= 2, "long merge field must increase segments");

const mms = creditsForRecipientBody({
  template: "Photo",
  isMms: true,
  vars: {},
});
assert.equal(mms.credits, MASS_TEXT_MMS_CREDIT_MULTIPLIER);
assert.equal(creditsForRenderedMessage({ isMms: true, smsSegments: 9 }), 3);

const unresolved = renderMassTextBody("Hello {{first-name}}", {});
assert.equal(unresolved.body.includes("{{"), false);
assert.ok(unresolved.unresolved.length >= 1);

const csv = parseCsv(
  'First Name,Phone,Notes\nAmy,"+1 (555) 111-2222","said, hello"\n\nBob,5553334444,\n',
);
assert.equal(csv.length, 3);
assert.equal(csv[1][2], "said, hello");
assert.equal(csv[2][0], "Bob");

assert.equal(normalizeE164("(555) 111-2222"), "+15551112222");
assert.equal(normalizeE164("555-111-2222"), "+15551112222");
assert.equal(normalizeE164("+15551112222"), "+15551112222");
assert.equal(normalizeE164("1 555 111 2222"), "+15551112222");
let malformed = false;
try {
  normalizeE164("not-a-phone");
} catch {
  malformed = true;
}
assert.equal(malformed, true);

assert.equal(
  inferInboundProductSource({
    phoneSettingsJson: { mctbRole: "customer_mctb" },
    campaignId: "camp_mass",
    campaignProductSource: "mass_text",
  }),
  "mctb",
);
assert.equal(
  inferInboundProductSource({
    phoneSettingsJson: { massTextRole: "primary" },
  }),
  "mass_text",
);

assert.equal(getCampaignCategory("promotional")?.id, "promotion");
assert.equal(getCampaignCategory("promotion")?.id, "promotion");

console.log("test-mass-texting-credit-units: ok");
