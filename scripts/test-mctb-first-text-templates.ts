/**
 * Deterministic first-text template renderer + validation.
 * Run: npx tsx scripts/test-mctb-first-text-templates.ts
 */
import assert from "node:assert/strict";
import {
  MCTB_FIRST_TEXT_TEMPLATE_ORDER,
  getMctbFirstTextTemplate,
} from "../src/lib/mctb/first-text-templates/registry";
import {
  assertMctbFirstTextSafeForSend,
  renderMctbFirstTextTemplateBody,
  validateMctbFirstTextTemplateConfig,
} from "../src/lib/mctb/first-text-templates/render";
import { defaultMctbFirstTextTemplateConfig } from "../src/lib/mctb/first-text-templates/config-defaults";
import { isMctbFirstTextTemplateEntitled } from "../src/lib/mctb/first-text-templates/entitlements";
import { buildInformationRequestPhrase } from "../src/lib/mctb/first-text-templates/information-request-phrase";
import {
  guessCallerFirstNameFromReply,
  renderMctbDeterministicFirstReplyAck,
} from "../src/lib/mctb/first-text-templates/deterministic-first-reply-ack";

const business = "Joe's Plumbing";

for (const id of MCTB_FIRST_TEXT_TEMPLATE_ORDER) {
  const cfg = defaultMctbFirstTextTemplateConfig(id);
  if (id === "quick_question") {
    cfg.variables.service1 = "a repair";
    cfg.variables.service2 = "an estimate";
  }
  const v = validateMctbFirstTextTemplateConfig(cfg, business, true);
  assert.equal(v.ok, true, `${id} should validate in hours`);
  const body = renderMctbFirstTextTemplateBody({
    config: cfg,
    businessName: business,
    inBusinessHours: true,
  });
  assertMctbFirstTextSafeForSend(body);
  assert.ok(body.includes(business), `${id} should include business name`);
}

const qq = defaultMctbFirstTextTemplateConfig("quick_question");
qq.variables.service1 = "";
const bad = validateMctbFirstTextTemplateConfig(qq, business, true);
assert.equal(bad.ok, false);

const onJob = renderMctbFirstTextTemplateBody({
  config: defaultMctbFirstTextTemplateConfig("on_a_job"),
  businessName: business,
  inBusinessHours: true,
});
assert.match(onJob, /within 30 minutes/);

const onJobAh = renderMctbFirstTextTemplateBody({
  config: defaultMctbFirstTextTemplateConfig("on_a_job"),
  businessName: business,
  inBusinessHours: false,
});
assert.match(onJobAh, /reopen tomorrow morning/i);

assert.equal(isMctbFirstTextTemplateEntitled("simple", { recoveryPaid: false }), true);
assert.equal(isMctbFirstTextTemplateEntitled("on_a_job", { recoveryPaid: false }), false);
assert.equal(isMctbFirstTextTemplateEntitled("on_a_job", { recoveryPaid: true }), true);

assert.equal(getMctbFirstTextTemplate("simple").name, "Simple");

const phrase = buildInformationRequestPhrase(
  defaultMctbFirstTextTemplateConfig("on_a_job").informationRequestFields!,
);
assert.match(phrase, /your name/);
assert.match(phrase, /service address/);

const ack = renderMctbDeterministicFirstReplyAck({
  businessName: "Joe's Plumbing",
  callbackTimePhrase: "within 30 minutes",
  callerFirstName: guessCallerFirstNameFromReply(
    "Mike, 123 Main Street. Water heater leaking.",
  ),
  inBusinessHours: true,
});
assert.match(ack, /Thanks, Mike/);
assert.match(ack, /within 30 minutes/);

console.log("test-mctb-first-text-templates: PASS");
