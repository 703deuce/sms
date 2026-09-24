/**
 * D2 — Message.from persistence matches explicit sender route (PLATFORM + WORKSPACE).
 */
import assert from "node:assert/strict";
import {
  resolvePersistedOutboundMessageFrom,
  resolveProviderOutboundFromE164,
} from "../src/lib/sms/persisted-message-from";
import { latestConversationOutboundAt } from "../src/lib/mctb/messaging/platform-inbound-tenant-resolution";
import { resolvePlatformInboundReplyFromContexts } from "../src/lib/mctb/messaging/platform-inbound-tenant-resolution";

const PLATFORM = "+18885046264";
const WORKSPACE_571 = "+15714073615";

// PLATFORM — senderRoute must win over workspace preferredFrom
{
  const persisted = resolvePersistedOutboundMessageFrom({
    senderRouteFromE164: PLATFORM,
    explicitFrom: PLATFORM,
    preferredWorkspaceFrom: WORKSPACE_571,
    registrationFrom: WORKSPACE_571,
  });
  assert.equal(persisted, PLATFORM);

  const provider = resolveProviderOutboundFromE164({
    senderRouteFromE164: PLATFORM,
    explicitFrom: PLATFORM,
    preferredWorkspaceFrom: WORKSPACE_571,
  });
  assert.equal(provider, PLATFORM);
}

// WORKSPACE — no route; explicit from wins over preferred when both set
{
  const persisted = resolvePersistedOutboundMessageFrom({
    explicitFrom: WORKSPACE_571,
    preferredWorkspaceFrom: WORKSPACE_571,
    registrationFrom: "+15555550100",
  });
  assert.equal(persisted, WORKSPACE_571);
}

// Legacy — preferred when no route/explicit
{
  const persisted = resolvePersistedOutboundMessageFrom({
    preferredWorkspaceFrom: WORKSPACE_571,
    registrationFrom: "+15555550100",
  });
  assert.equal(persisted, WORKSPACE_571);
}

// D1 — missing nested messages does not throw; resolver still works on other evidence
assert.equal(latestConversationOutboundAt(undefined), undefined);
assert.equal(latestConversationOutboundAt(null), undefined);
assert.equal(latestConversationOutboundAt([]), undefined);
const at = new Date("2026-09-24T19:00:00Z");
assert.equal(
  latestConversationOutboundAt([{ createdAt: at }])?.toISOString(),
  at.toISOString(),
);

const resolution = resolvePlatformInboundReplyFromContexts([
  {
    workspaceId: "ws_1",
    conversationId: "conv_1",
    lastOutboundAt: at,
  },
]);
assert.equal(resolution.status, "RESOLVED");

console.log("test-mctb-message-from-persistence: ok");
