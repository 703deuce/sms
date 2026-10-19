#!/usr/bin/env node
/**
 * Offline contract checks for Telnyx inbound WebRTC (no API, no build).
 * Run: node scripts/test-new-app-inbound-telnyx-contract.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bridgeSrc = readFileSync(
  join(root, "new-app/lib/server/phone/inbound-webrtc-bridge.ts"),
  "utf8",
);

assert.match(
  bridgeSrc,
  /connection_id:\s*callControlConnectionId/,
  "Dial must use Call Control connection id variable",
);
assert.doesNotMatch(
  bridgeSrc,
  /connection_id:\s*credentialConnectionId/,
  "Dial must not use WebRTC credential connection id",
);
assert.match(
  bridgeSrc,
  /call_control_id:\s*input\.agentCallControlId/,
  "Bridge body must use call_control_id per Telnyx Bridge API",
);
assert.match(
  bridgeSrc,
  /bridge_on_answer:\s*true/,
  "Dial must use bridge_on_answer so PSTN is not answered before the agent picks up",
);
assert.match(
  bridgeSrc,
  /link_to:\s*input\.telnyxCallControlId/,
  "Dial must link outbound agent leg to inbound PSTN leg",
);
assert.doesNotMatch(
  bridgeSrc,
  /bridgeInboundCallToWebRtc[\s\S]*?telnyxCallAction\(input\.telnyxCallControlId,\s*"answer"\)[\s\S]*?\/calls/,
  "Must not answer PSTN before dialing the browser leg",
);
const actionsSrc = readFileSync(
  join(root, "new-app/lib/server/phone/telnyx-call-actions.ts"),
  "utf8",
);
assert.match(actionsSrc, /encodeURIComponent/);

const wpSrc = readFileSync(
  join(root, "new-app/components/providers/workspace-provider.tsx"),
  "utf8",
);
assert.match(wpSrc, /callUpdate/, "WebRTC must listen for callUpdate notifications");
assert.match(wpSrc, /inbound_ringing_ui/, "Incoming ring must log for correlation");
assert.match(wpSrc, /remoteElement/, "Answer must attach remote audio element");

const tokenSrc = readFileSync(join(root, "new-app/lib/server/phone/webrtc-token.ts"), "utf8");
assert.doesNotMatch(
  tokenSrc,
  /markWebRtcRegistered\([^)]*true/,
  "Token mint must not mark WebRTC registered (telnyx.ready only)",
);

console.log("PASS test-new-app-inbound-telnyx-contract");
