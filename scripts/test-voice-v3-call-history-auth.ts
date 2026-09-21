/**
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-call-history-auth.ts
 */
import assert from "node:assert/strict";
import {
  createRecordingAccessToken,
  verifyRecordingAccessToken,
} from "../src/lib/voice/recordings";

const { token } = createRecordingAccessToken("rec_a", "ws_a", 60);
assert.equal(verifyRecordingAccessToken(token)?.workspaceId, "ws_a");

const wrongWs = token.replace("ws_a", "ws_b");
assert.equal(verifyRecordingAccessToken(wrongWs), null, "tampered workspace rejected");

const expired = createRecordingAccessToken("rec_a", "ws_a", -10);
assert.equal(verifyRecordingAccessToken(expired.token), null, "expired token rejected");

console.log("test-voice-v3-call-history-auth: PASS");
