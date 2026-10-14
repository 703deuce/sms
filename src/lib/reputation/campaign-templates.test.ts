import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applySuccessModeToSequence,
  CAMPAIGN_SYSTEM_TEMPLATES,
  featuredCampaignTemplate,
  getCampaignSystemTemplate,
  listCampaignSystemTemplates,
  materializeCampaignTemplate,
  recommendCampaignTemplate,
} from "@/lib/reputation/campaign-templates";
import {
  normalizeSequenceSteps,
  validateSequenceForLaunch,
  sequenceStartsWithWait,
  resolveWaveChannels,
} from "@/lib/reputation/sequence-engine";

describe("campaign system templates", () => {
  it("ships exactly six versioned templates", () => {
    assert.equal(CAMPAIGN_SYSTEM_TEMPLATES.length, 6);
    for (const t of CAMPAIGN_SYSTEM_TEMPLATES) {
      assert.ok(t.id);
      assert.ok(t.version);
      assert.ok(t.sequence.length >= 2);
      assert.equal(t.successMode, "click");
      assert.ok(t.duplicateProtectionDays >= 60);
      assert.ok(t.messages.length >= 1);
      assert.ok(!/five[-\s]?star/i.test(JSON.stringify(t.messages)));
      assert.ok(!/discount/i.test(JSON.stringify(t.messages)));
    }
  });

  it("features SMS + Email Follow-Up", () => {
    const featured = featuredCampaignTemplate();
    assert.equal(featured.id, "sms-email-follow-up");
    assert.equal(featured.channel, "both");
  });

  it("recommends email-only when SMS unavailable", () => {
    assert.equal(
      recommendCampaignTemplate({ hasSmsConsentCapability: false }).id,
      "email-only-gentle"
    );
    assert.equal(
      recommendCampaignTemplate({ isHomeService: true, hasSmsConsentCapability: true }).id,
      "sms-first-quick-request"
    );
  });

  it("every template sequence validates for launch", () => {
    for (const t of CAMPAIGN_SYSTEM_TEMPLATES) {
      const steps = normalizeSequenceSteps(t.sequence);
      const err = validateSequenceForLaunch(steps);
      assert.equal(err, null, `${t.id}: ${err}`);
    }
  });

  it("materialize deep-copies without mutating the catalog", () => {
    const before = JSON.stringify(getCampaignSystemTemplate("sms-first-quick-request")?.sequence);
    const m = materializeCampaignTemplate("sms-first-quick-request");
    assert.ok(m);
    m!.sequence[0]!.config.hours = 99;
    const after = JSON.stringify(getCampaignSystemTemplate("sms-first-quick-request")?.sequence);
    assert.equal(before, after);
    assert.equal(m!.sourceTemplateId, "sms-first-quick-request");
    assert.equal(m!.duplicateProtectionDays, 60);
  });

  it("sms-first starts with a short wait then SMS", () => {
    const t = getCampaignSystemTemplate("sms-first-quick-request")!;
    assert.ok(sequenceStartsWithWait(t.sequence));
    assert.equal(t.sequence[0]!.config.hours, 2);
    assert.equal(t.sequence[1]!.step_type, "send_sms");
  });

  it("one-touch prefer_single resolves to a single channel", () => {
    const t = getCampaignSystemTemplate("one-touch-minimal")!;
    const step = t.sequence.find((s) => s.step_type.startsWith("send_"))!;
    assert.deepEqual(
      resolveWaveChannels({
        campaignChannel: "both",
        step,
        hasPhone: true,
        hasEmail: true,
      }),
      ["sms"]
    );
    assert.deepEqual(
      resolveWaveChannels({
        campaignChannel: "both",
        step,
        hasPhone: false,
        hasEmail: true,
      }),
      ["email"]
    );
  });

  it("filters past-customer reactivation", () => {
    const list = listCampaignSystemTemplates(["past-customer-reactivation"]);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, "past-customer-reactivation");
    assert.equal(list[0]!.suitableForWebhook, false);
    assert.equal(list[0]!.objective, "reactivation");
  });

  it("includes STOP language on every SMS body", () => {
    for (const t of CAMPAIGN_SYSTEM_TEMPLATES) {
      for (const m of t.messages.filter((x) => x.channel === "sms")) {
        assert.match(m.body, /STOP/i, `${t.id} ${m.step_key}`);
      }
    }
  });

  it("delayed template previews both SMS and email copy", () => {
    const t = getCampaignSystemTemplate("delayed-post-completion")!;
    assert.ok(t.messages.some((m) => m.channel === "sms"));
    assert.ok(t.messages.some((m) => m.channel === "email"));
  });

  it("conservative success mode drops click from eligibility gates", () => {
    const t = getCampaignSystemTemplate("sms-first-quick-request")!;
    const rewritten = applySuccessModeToSequence(t.sequence, "conservative");
    const gate = rewritten.find((s) => s.step_type === "condition");
    assert.ok(gate);
    const all = gate!.config.all as string[];
    assert.ok(!all.includes("no_activity"));
    assert.ok(all.includes("review_detected:false"));
  });
});
