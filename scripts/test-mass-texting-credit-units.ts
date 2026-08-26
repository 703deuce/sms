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
import { getCampaignCategory, buildSequenceForCategory } from "../src/lib/campaigns/catalog";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { classifySmsProviderError } from "../src/lib/mass-texting/provider-errors";
import {
  attachMediaToFirstSmsStep,
  evaluateCondition,
  sendSmsBodiesForCreditEstimate,
} from "../src/lib/campaigns/sequence-engine";
import {
  campaignChannelForMedia,
  mediaUrlsForSequenceStep,
  normalizeMediaUrls,
} from "../src/lib/mass-texting/mms";
import {
  consumeMassTextRateLimit,
  resetMassTextRateLimitForTests,
} from "../src/lib/mass-texting/rate-limit";
import { MASS_TEXT_RECURRING_PRODUCTION_ENABLED } from "../src/lib/mass-texting/constants";
import { canonicalLaunchIdempotencyKey } from "../src/lib/mass-texting/launch-key";
import { massTextingMetadataFromInvoice } from "../src/lib/mass-texting/stripe-metadata";
import {
  isCertBrowserLoopbackHost,
  isCertBrowserPublicProductionHost,
} from "../src/lib/auth/cert-browser-host";

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

assert.equal(classifySmsProviderError("HTTP 400 invalid to"), "terminal");
assert.equal(classifySmsProviderError("status 401"), "terminal");
assert.equal(classifySmsProviderError("403 forbidden"), "terminal");
assert.equal(classifySmsProviderError("404 not found"), "terminal");
assert.equal(classifySmsProviderError("422 unprocessable"), "terminal");
assert.equal(classifySmsProviderError("HTTP 429 too many requests"), "retryable");
assert.equal(classifySmsProviderError("500 provider unavailable"), "retryable");
assert.equal(classifySmsProviderError("ETIMEDOUT"), "retryable");

const replyGate = {
  step_key: "gate_1",
  step_type: "condition" as const,
  config: { when: "customer_replied", then: "end", else: "sms_2" },
};
assert.equal(evaluateCondition(replyGate, { customer_replied: true }), "end");
assert.equal(evaluateCondition(replyGate, { customer_replied: false }), "sms_2");
assert.equal(MASS_TEXT_RECURRING_PRODUCTION_ENABLED, false);

const followUpBodies = sendSmsBodiesForCreditEstimate(
  buildSequenceForCategory("follow_up", "Hi there", { followUpCount: 3 }),
  "Hi there",
);
assert.equal(followUpBodies.length, 3, "follow-up sequences must reserve every SMS step");
assert.equal(sendSmsBodiesForCreditEstimate(null, "Solo").length, 1);

assert.deepEqual(normalizeMediaUrls(["https://cdn.example.com/a.jpg", "not-a-url", "https://cdn.example.com/a.jpg"]), [
  "https://cdn.example.com/a.jpg",
]);
assert.equal(campaignChannelForMedia(["https://cdn.example.com/a.jpg"]), "mms");
assert.equal(campaignChannelForMedia([]), "sms");
const followUpWithPics = attachMediaToFirstSmsStep(
  buildSequenceForCategory("follow_up", "Hi there", { followUpCount: 3 }),
  ["https://cdn.example.com/a.jpg"],
);
const smsStepsWithPics = followUpWithPics.filter((s) => s.step_type === "send_sms");
assert.equal(smsStepsWithPics.length, 3);
assert.deepEqual(smsStepsWithPics[0].config?.mediaUrls, ["https://cdn.example.com/a.jpg"]);
assert.equal(smsStepsWithPics[1].config?.mediaUrls, undefined);
assert.equal(
  mediaUrlsForSequenceStep(smsStepsWithPics[0], { mediaUrls: ["https://cdn.example.com/a.jpg"] }, followUpWithPics)
    .length,
  1,
);
assert.equal(
  mediaUrlsForSequenceStep(smsStepsWithPics[1], { mediaUrls: ["https://cdn.example.com/a.jpg"] }, followUpWithPics)
    .length,
  0,
);
assert.equal(campaignChannelForMedia(mediaUrlsForSequenceStep(smsStepsWithPics[0], {}, followUpWithPics)), "mms");
assert.equal(campaignChannelForMedia(mediaUrlsForSequenceStep(smsStepsWithPics[1], {}, followUpWithPics)), "sms");

assert.equal(
  canonicalLaunchIdempotencyKey("ws1", "camp1", "launch:camp1"),
  "launch:ws1:camp1",
);
assert.equal(
  canonicalLaunchIdempotencyKey("ws1", "camp1", "launch:ws1:camp1"),
  "launch:ws1:camp1",
);

const renewalMd = massTextingMetadataFromInvoice({
  metadata: {},
  subscription: {
    id: "sub_1",
    metadata: {
      product: "mass_texting",
      workspaceId: "ws_mt",
      monthlyTier: "growth",
    },
  },
});
assert.equal(renewalMd.product, "mass_texting");
assert.equal(renewalMd.workspaceId, "ws_mt");
assert.equal(renewalMd.monthlyTier, "growth");

assert.equal(isCertBrowserLoopbackHost("127.0.0.1"), true);
assert.equal(isCertBrowserPublicProductionHost("transovo.ai"), true);
assert.equal(isCertBrowserPublicProductionHost("app.transovo.ai"), true);
assert.equal(isCertBrowserPublicProductionHost("localhost"), false);

resetMassTextRateLimitForTests();
for (let i = 0; i < 8; i += 1) {
  assert.equal(consumeMassTextRateLimit("test-ws").ok, true);
}
assert.equal(consumeMassTextRateLimit("test-ws").ok, false);

console.log("test-mass-texting-credit-units: ok");
