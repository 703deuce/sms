#!/usr/bin/env tsx
/**
 * After-hours V1 pipeline invariants (no live PSTN).
 * npx tsx scripts/test-after-hours-voice-pipeline.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { applyHarborDrainProsWizardKnowledge } from "../src/lib/receptionist-wizard/harbor-drain-pros-config";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  buildAmyConversationWorkflow,
  WORKFLOW_NODE_IDS,
} from "../src/lib/voice/telnyx/conversation-workflow";
import {
  filterToolsForCallerAmyPublish,
  isConversationWorkflowMode,
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
} from "../src/lib/voice/workflow-engine/tool-publish";
import { deriveLeadRecoveryPolicyFromWizard } from "../src/lib/voice/runtime/wizard-policy-bridge";
import { isAfterHoursVoiceProfile } from "../src/lib/voice/runtime/voice-profile";
import { filterPublishedToolsForRuntime } from "../src/lib/voice/runtime/capability-resolver";
import { emptyVoiceCallState } from "../src/lib/voice/runtime/call-state";
import { SEND_RESOURCE_WEBHOOK_BODY } from "../src/lib/voice/tools/builtin-webhook-bodies";
import { sendResourceConsentAllowed } from "../src/lib/voice/tools/send-resource-consent";
import { getAppBaseUrl } from "../src/lib/messaging/telnyx/config";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

function main() {
  let wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard = applyHarborDrainProsWizardKnowledge(wizard);
  wizard.appointmentTypes = [
    {
      id: "1",
      name: "Service Visit",
      durationMin: 60,
      calendar: "default",
      status: "ready",
      requiredFields: [],
      bookingPermission: "send_booking_link",
      enabled: true,
    },
  ];

  assert.ok(isAfterHoursVoiceProfile(wizard), "after_hours profile");
  const policy = deriveLeadRecoveryPolicyFromWizard(wizard);
  assert.ok(
    !policy.intentPolicies.BOOKING_REQUEST?.actions?.includes("AI_BOOK"),
    "no AI_BOOK on after-hours",
  );
  assert.ok(
    policy.intentPolicies.BOOKING_REQUEST?.actions?.includes("SEND_BOOKING_LINK"),
    "booking link action",
  );

  let config = buildWizardAgentConfig(wizard);
  config = applyAmyMinimumSideEffectConfig(config);
  assert.ok(isConversationWorkflowMode(config), "conversation workflow mode");

  const published = filterToolsForCallerAmyPublish(config.enabledBuiltinTools || [], config);
  for (const t of WORKFLOW_PUBLISHED_WEBHOOK_TOOLS) {
    assert.ok(published.includes(t), `published includes ${t}`);
  }

  const graph = buildAmyConversationWorkflow(
    {
      sendResource: "st_send",
      searchDetails: "st_search",
      hangup: "st_hangup",
      transfer: "st_transfer",
    },
    config,
  );
  const edges = graph.edges as Array<{ id?: string; condition?: { prompt?: string } }>;
  assert.ok(
    edges.find((e) => e.id === "e_general_action")?.condition?.prompt?.includes("agreed"),
    "ACTION edge requires SMS agreement",
  );
  const actionNode = (graph.nodes as Array<{ id: string; instructions?: string }>).find(
    (n) => n.id === WORKFLOW_NODE_IDS.ACTION,
  );
  assert.ok(actionNode?.instructions?.includes("verbal_sms_consent"), "ACTION mentions consent");

  const outbound = (config.messaging as { outboundSms?: { mode?: string } })?.outboundSms;
  assert.ok(outbound?.mode === "workspace_preferred" || outbound?.mode === "auto", "toll-free sms mode");

  const required = (SEND_RESOURCE_WEBHOOK_BODY.required as string[]) || [];
  assert.ok(required.includes("resource_type"), "send_resource schema has resource_type");
  assert.ok(
    !required.includes("verbal_sms_consent"),
    "verbal_sms_consent optional at webhook (workflow + server consent)",
  );

  assert.equal(
    sendResourceConsentAllowed({
      resourceType: "booking",
      priorConsent: false,
      afterHoursProfile: true,
    }),
    false,
    "after-hours booking SMS blocked without explicit consent",
  );
  assert.equal(
    sendResourceConsentAllowed({
      resourceType: "booking",
      priorConsent: false,
      verbalSmsConsent: true,
      afterHoursProfile: true,
    }),
    true,
    "after-hours booking SMS allowed after verbal yes",
  );

  const greetState = emptyVoiceCallState({
    callId: "call_test",
    workspaceId: "ws_test",
    agentId: "agent_test",
  });
  const sendOk = filterPublishedToolsForRuntime({
    requestedTool: "send_resource",
    callState: greetState,
    agentConfig: config,
  });
  assert.equal(sendOk.allowed, true, "send_resource allowed in GREETING under conversation workflow");

  const base = getAppBaseUrl();
  if (base.includes("localhost")) {
    console.warn("WARN: APP_URL is localhost — Telnyx production webhooks will not reach this host.");
  }

  assert.ok(
    !wizard.openingGreeting?.includes("appointment booking agent"),
    "harbor greeting is after-hours",
  );

  console.log("test-after-hours-voice-pipeline: PASS");
}

main();
