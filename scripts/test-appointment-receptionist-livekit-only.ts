#!/usr/bin/env tsx
/**
 * AI Receptionist must never route to Voice V3 Basic.
 * npx tsx scripts/test-appointment-receptionist-livekit-only.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import {
  appointmentReceptionistRequiresLiveKitIngress,
  assertAppointmentReceptionistLiveKitPublish,
  isLiveKitSipProvisionActive,
  readTelephonyProvisionFromSettings,
} from "../src/lib/voice-v3/receptionist-livekit-policy";
const receptionistCfg = parseVoiceAgentConfig({
  advanced: { capabilityPack: "appointment_receptionist", appointmentReceptionistWizard: true },
});

assert.ok(appointmentReceptionistRequiresLiveKitIngress(receptionistCfg));
assert.throws(
  () =>
    assertAppointmentReceptionistLiveKitPublish({
      ...receptionistCfg,
      advanced: {
        ...(receptionistCfg.advanced as object),
        voiceTransport: "voice_v3_basic",
      },
    }),
  /LiveKit/,
);

const activeLk = readTelephonyProvisionFromSettings({
  telephony: {
    routingMode: "livekit_sip",
    state: "active",
    livekitInboundTrunkId: "trunk-1",
  },
});
assert.ok(isLiveKitSipProvisionActive(activeLk));

const agentService = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice/agent-service.ts"),
  "utf8",
);
assert.ok(
  agentService.includes("provisionAppointmentReceptionistLiveKit"),
  "publish must provision LiveKit for receptionist",
);
assert.ok(
  !agentService.includes("VOICE_V3_RECEPTIONIST_PHONE_ROUTED_V3_BASIC"),
  "publish must not log Basic routing for receptionist",
);

const pstn = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice-v3/start-appointment-receptionist-pstn.ts"),
  "utf8",
);
assert.ok(
  !pstn.includes("forwardInboundCallToOpenAiLiveSip"),
  "PSTN entry must not forward to Voice V3 Basic SIP",
);
assert.ok(pstn.includes("livekit_sip_required"), "PSTN entry must require LiveKit");

const wizard = fs.readFileSync(
  path.join(process.cwd(), "src/components/solutions/appointment-receptionist/wizard.tsx"),
  "utf8",
);
assert.ok(
  /stepIndex === 0 && !state\.agentId[\s\S]*else if \(state\.agentId\)[\s\S]*persist\("save_draft"\)/.test(
    wizard,
  ),
  "wizard Continue must save_draft before advancing when agent exists",
);

console.log("test-appointment-receptionist-livekit-only: PASS");
