#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "@/lib/server/voice-v3/state/call-context";
import { executeSendBookingLink } from "@/lib/server/voice-v3/booking-link/execute-send-booking-link";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";

const TZ = "America/New_York";
const clock = { businessLocalIso: "2026-10-22T10:00:00-04:00", utcIso: "2026-10-22T14:00:00.000Z" };

const config = {
  workspaceId: "ws_test",
  agentId: "ag_test",
  scheduling: { bookingStrategy: "SEND_LINK" as const },
  bookingStrategyDetail: {
    strategy: "SEND_LINK" as const,
    bookingLinkUrl: "https://example.com/book",
    executionStatus: "ACTIVE_EXECUTION" as const,
    sendLinkConsentRequired: false,
  },
  intakeFields: [
    { key: "i2", label: "Callback number", type: "phone" as const, required: true, description: "" },
  ],
} as VoiceV3AgentConfig;

const liveSessionId = "lk_transovo-call-_+15714776175_itXzNimRAKJi";

async function run() {
  let ctx = createInitialVoiceV3CallContext({
    callId: liveSessionId,
    liveSessionId,
    timezone: TZ,
    clock,
    inboundCallerE164: null,
  });

  const { result } = await executeSendBookingLink({
    workspaceId: "ws_test",
    config,
    context: ctx,
    args: { confirmed: true, destination_phone: "}" },
    deps: {
      resolveSmsSender: async () => ({ fromE164: "+18005551234", phoneNumberId: "pn_test" }),
      sendSms: async () => ({ providerMessageId: "msg_1", status: "queued" }),
    },
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  console.log("test-send-booking-link-destination: PASS");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
