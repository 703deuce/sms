#!/usr/bin/env tsx
/**
 * AI Recovery business knowledge — save → runtime prompt contract.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-ai-recovery-business-knowledge-contract.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  composeLeadRecoveryRuntimePromptBlock,
  loadMctbLeadRecoveryKnowledgeBundle,
  LEAD_RECOVERY_KNOWLEDGE_GROUNDING_RULES,
} from "../src/lib/mctb/lead-recovery/knowledge-prompt";
import type { MctbApprovedBusinessInformation } from "../src/lib/mctb/approved-business-information";
import { saveBusinessBrainPartial } from "../src/lib/agents/appointment-booking/business-brain";
import { saveMctbHandoffConfig } from "../src/lib/mctb/handoff/config";
import { saveLeadRecoveryConfig } from "../src/lib/mctb/lead-recovery/config";
import { defaultIntentPolicies } from "../src/lib/mctb/lead-recovery/policy-defaults";
import { getPrisma } from "../src/lib/db";
import { grantMctbAiRecoveryCommercialEntitlement } from "../src/lib/mctb/commercial-entitlement-grants";
import { resolveMctbCapabilities } from "../src/lib/mctb/capabilities";

const APPROVED_STUB: MctbApprovedBusinessInformation = {
  business_name: "Cert Plumbing",
  business_hours: "Mon–Fri 9–5",
  services: ["Drain cleaning"],
  locations: [{ name: "Fairfax County" }],
  website: null,
  knowledge_facts: [],
  about_business: null,
  prompt_block: "Business name: Cert Plumbing",
};

function testComposeIncludesAboutAndEmergency() {
  const block = composeLeadRecoveryRuntimePromptBlock({
    approved: APPROVED_STUB,
    aboutBusiness: "We repair residential plumbing in Fairfax.",
    emergencyCriteria: "Active flooding is an emergency.",
    emergencyDetectionEnabled: true,
  });
  assert.match(block, /We repair residential plumbing in Fairfax/);
  assert.match(block, /Active flooding is an emergency/);
  assert.match(block, /GROUNDING/);
  assert.ok(block.includes(LEAD_RECOVERY_KNOWLEDGE_GROUNDING_RULES.slice(0, 40)));
}

function testComposeOmitsEmergencyWhenDisabled() {
  const block = composeLeadRecoveryRuntimePromptBlock({
    approved: APPROVED_STUB,
    aboutBusiness: "Context only.",
    emergencyCriteria: "Should not appear as definition block",
    emergencyDetectionEnabled: false,
  });
  assert.match(block, /Context only/);
  assert.doesNotMatch(block, /EMERGENCY \/ URGENT DEFINITION/);
}

async function testDbRoundTrip() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP db round-trip (no DATABASE_URL)");
    return;
  }

  const prisma = getPrisma();
  const slug = `lr-knowledge-cert-${randomUUID().slice(0, 8)}`;
  const ws = await prisma.workspace.create({
    data: {
      name: slug,
      slug,
      displayName: "LR Knowledge Cert",
    },
  });
  const workspaceId = ws.id;
  const markerAbout = `CERT_ABOUT_${randomUUID()}`;
  const markerEmergency = `CERT_EMERGENCY_${randomUUID()}`;

  try {
    await saveBusinessBrainPartial(workspaceId, { aboutBusiness: markerAbout });
    await saveMctbHandoffConfig(workspaceId, {
      emergencyDetectionEnabled: true,
      emergencyCriteria: markerEmergency,
    });
    await grantMctbAiRecoveryCommercialEntitlement(workspaceId);
    const caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.aiRecoveryEntitled, true, "test workspace must be AI Recovery entitled");
    await saveLeadRecoveryConfig(workspaceId, {
      enabled: true,
      enabledScenarios: { general_faq: true, emergencies: true },
      enabledIntents: ["BUSINESS_FAQ", "EMERGENCY_OR_URGENT", "UNKNOWN", "OPT_OUT"],
      intentPolicies: defaultIntentPolicies("SEND_BOOKING_LINK"),
      policyHealth: "HEALTHY",
    });

    const brainReload = await loadMctbLeadRecoveryKnowledgeBundle(workspaceId);
    assert.equal(brainReload.about_business, markerAbout);
    assert.equal(brainReload.emergency_criteria, markerEmergency);
    assert.ok(brainReload.runtime_prompt_block.includes(markerAbout));
    assert.ok(brainReload.runtime_prompt_block.includes(markerEmergency));

    const markerAbout2 = `CERT_ABOUT_UPDATED_${randomUUID()}`;
    await saveBusinessBrainPartial(workspaceId, { aboutBusiness: markerAbout2 });
    const bundle2 = await loadMctbLeadRecoveryKnowledgeBundle(workspaceId);
    assert.ok(bundle2.runtime_prompt_block.includes(markerAbout2));
    assert.ok(!bundle2.runtime_prompt_block.includes(markerAbout));
  } finally {
    await prisma.mctbHandoffConfig.deleteMany({ where: { workspaceId } }).catch(() => undefined);
    await prisma.workspaceLimits.deleteMany({ where: { workspaceId } }).catch(() => undefined);
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
  }
}

async function main() {
  testComposeIncludesAboutAndEmergency();
  testComposeOmitsEmergencyWhenDisabled();
  await testDbRoundTrip();
  console.log("PASS test-mctb-ai-recovery-business-knowledge-contract");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
