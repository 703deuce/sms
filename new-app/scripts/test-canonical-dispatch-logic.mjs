/**
 * Canonical V3 shared dispatch helpers (no LiveKit API).
 */
import assert from "node:assert/strict";
import {
  buildCanonicalV3DispatchAgentMetadata,
  isObsoletePerDidDispatchRuleName,
  isTrustedInboundDialedE164Source,
  OBSOLETE_PER_DID_DISPATCH_PREFIX,
} from "../lib/server/receptionist/livekit/canonical-dispatch-helpers.ts";

assert.equal(OBSOLETE_PER_DID_DISPATCH_PREFIX, "transovo-did-dispatch-");
assert.ok(isObsoletePerDidDispatchRuleName("transovo-did-dispatch-15717491685"));
assert.ok(!isObsoletePerDidDispatchRuleName("transovo-inbound-dispatch"));

const meta = JSON.parse(buildCanonicalV3DispatchAgentMetadata());
assert.equal(meta.runtime, "voice_v3_gpt_live");
assert.equal(meta.resolve, "http_backend_on_sip");
assert.equal(meta.workspaceId, undefined);
assert.equal(meta.agentId, undefined);

assert.ok(isTrustedInboundDialedE164Source("sip.trunkPhoneNumber"));
assert.ok(!isTrustedInboundDialedE164Source("job_metadata.workspaceId"));

console.log("test-canonical-dispatch-logic: PASS");
