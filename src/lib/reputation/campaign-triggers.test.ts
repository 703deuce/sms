import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTriggerType,
  parseTriggerConfig,
  recommendedTemplateIdsForTrigger,
  templateFiltersForTrigger,
  triggerLabel,
  triggerTimelineLabel,
} from "@/lib/reputation/campaign-triggers";

describe("campaign triggers", () => {
  it("normalizes trigger types", () => {
    assert.equal(normalizeTriggerType("webhook"), "webhook");
    assert.equal(normalizeTriggerType("api"), "api");
    assert.equal(normalizeTriggerType("manual"), "manual");
    assert.equal(normalizeTriggerType("nope"), "manual");
  });

  it("recommends different templates for manual vs webhook", () => {
    const manual = recommendedTemplateIdsForTrigger("manual");
    const auto = recommendedTemplateIdsForTrigger("webhook");
    assert.ok(manual.includes("past-customer-reactivation"));
    assert.ok(auto.includes("sms-email-follow-up"));
    assert.ok(auto.includes("sms-first-quick-request"));
    assert.deepEqual(templateFiltersForTrigger("manual"), ["manual-csv"]);
    assert.ok(templateFiltersForTrigger("webhook").includes("automatic"));
  });

  it("defaults allowManualEnrollment so staff can add missed contacts", () => {
    const cfg = parseTriggerConfig({});
    assert.equal(cfg.allowManualEnrollment, true);
    assert.equal(cfg.eventType, "service.completed");
    assert.equal(parseTriggerConfig({ allowManualEnrollment: false }).allowManualEnrollment, false);
  });

  it("formats trigger labels for timeline", () => {
    assert.equal(triggerTimelineLabel("manual"), "Manual enrollment");
    assert.equal(triggerTimelineLabel("api"), "API enrollment");
    assert.equal(
      triggerTimelineLabel("webhook", parseTriggerConfig({ eventType: "invoice.paid" })),
      "Webhook: invoice.paid"
    );
    assert.match(triggerLabel("webhook", { eventType: "service.completed" }), /Webhook/);
    assert.equal(triggerLabel("manual"), "Manual / CSV");
  });
});
