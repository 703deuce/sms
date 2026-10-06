/**
 * Static checks for deterministic first-text template architecture (no DB).
 * Used by verify:mctb-final-pipeline and commercial guards.
 */
import assert from "node:assert/strict";
import { defaultMctbFirstTextTemplateConfig } from "../../src/lib/mctb/first-text-templates/config-defaults";
import {
  assertMctbFirstTextSafeForSend,
  renderMctbFirstTextTemplateBody,
} from "../../src/lib/mctb/first-text-templates/render";
import { buildInformationRequestPhrase } from "../../src/lib/mctb/first-text-templates/information-request-phrase";
import {
  guessCallerFirstNameFromReply,
  renderMctbDeterministicFirstReplyAck,
} from "../../src/lib/mctb/first-text-templates/deterministic-first-reply-ack";
import { resolveMctbRecoveryOpenerTemplate } from "../../src/lib/mctb/message-template";
import { DEFAULT_MCTB_CONFIG } from "../../src/lib/agents/missed-call-text-back/types";

export type DeterministicFirstTextCheck = { name: string; ok: boolean; detail?: string };

export function runMctbDeterministicFirstTextChecks(): DeterministicFirstTextCheck[] {
  const checks: DeterministicFirstTextCheck[] = [];
  const business = "Acme Plumbing";

  try {
    const cfg = defaultMctbFirstTextTemplateConfig("simple");
    const bh = renderMctbFirstTextTemplateBody({
      config: cfg,
      businessName: business,
      inBusinessHours: true,
    });
    const ah = renderMctbFirstTextTemplateBody({
      config: cfg,
      businessName: business,
      inBusinessHours: false,
    });
    assertMctbFirstTextSafeForSend(bh);
    assertMctbFirstTextSafeForSend(ah);
    assert.ok(bh.includes(business));
    assert.ok(ah.includes(business));
    assert.ok(!bh.includes("{{"));
    assert.ok(!ah.includes("{{"));
    assert.ok(bh !== ah, "BH and AH bodies should differ for simple template");
    checks.push({ name: "first_text_bh_ah_render", ok: true });
  } catch (e) {
    checks.push({
      name: "first_text_bh_ah_render",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const onJob = defaultMctbFirstTextTemplateConfig("on_a_job");
    const phrase = buildInformationRequestPhrase(onJob.informationRequestFields!);
    assert.ok(phrase.length > 10);
    assert.ok(!phrase.includes("{{"));
    checks.push({ name: "information_request_phrase", ok: true, detail: phrase.slice(0, 80) });
  } catch (e) {
    checks.push({
      name: "information_request_phrase",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const platform = resolveMctbRecoveryOpenerTemplate({
      ...DEFAULT_MCTB_CONFIG,
      senderMode: "PLATFORM",
    });
    assert.ok(platform.includes("Your business"));
    assert.ok(!platform.includes("{{"));
    checks.push({ name: "platform_default_template_resolves", ok: true });
  } catch (e) {
    checks.push({
      name: "platform_default_template_resolves",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    const ack = renderMctbDeterministicFirstReplyAck({
      businessName: business,
      callbackTimePhrase: "within 30 minutes",
      callerFirstName: guessCallerFirstNameFromReply("Sam — leak under sink"),
      inBusinessHours: true,
    });
    assert.ok(ack.trim().length > 20);
    assert.ok(!ack.includes("{{"));
    checks.push({ name: "deterministic_acknowledgment", ok: true });
  } catch (e) {
    checks.push({
      name: "deterministic_acknowledgment",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  return checks;
}
