#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { isVoiceAgentOutboundSmsSelectablePhone } from "../src/lib/voice/sms/voice-agent-outbound-sms-inventory";

assert.equal(
  isVoiceAgentOutboundSmsSelectablePhone({
    e164: "+15714073615",
    status: "Active",
    a2pStatus: "APPROVED",
    type: "local",
    settingsJson: {},
  }),
  true,
);

assert.equal(
  isVoiceAgentOutboundSmsSelectablePhone({
    e164: "+18665551234",
    status: "Active",
    a2pStatus: "APPROVED",
    type: "toll_free",
    settingsJson: {},
  }),
  false,
  "toll-free excluded from voice-agent local picker",
);

assert.equal(
  isVoiceAgentOutboundSmsSelectablePhone({
    e164: "+15714073615",
    status: "Active",
    a2pStatus: "PENDING",
    type: "local",
    settingsJson: {},
  }),
  false,
  "pending not selectable until released approved",
);

assert.equal(
  isVoiceAgentOutboundSmsSelectablePhone({
    e164: "+15714073615",
    status: "Active",
    a2pStatus: "APPROVED",
    type: "local",
    settingsJson: { mctbRole: "platform_mctb_sender" },
  }),
  false,
);

console.log("voice-agent-outbound-sms-inventory: PASS");
