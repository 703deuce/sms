/**
 * MCTB platform sender — resolution, ambiguity, WORKSPACE explicit SMS priority.
 * Run: npx tsx scripts/test-mctb-platform-sender.ts
 */
import assert from "node:assert/strict";
import {
  resolvePlatformInboundReplyFromContexts,
  type PlatformMctbReplyContext,
} from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import {
  isPlatformMctbSenderPhoneRecord,
  platformMctbSenderSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { isMirrorOrArchivedPhoneRow } from "@/lib/messaging/inbound-workspace-routing-policy";

function ctx(workspaceId: string, at: string): PlatformMctbReplyContext {
  return {
    workspaceId,
    conversationId: `conv_${workspaceId}`,
    lastOutboundAt: new Date(at),
  };
}

// Ambiguity: two workspaces — must not pick one
{
  const resolution = resolvePlatformInboundReplyFromContexts([
    ctx("ws_a", "2026-09-24T10:00:00Z"),
    ctx("ws_b", "2026-09-24T10:05:00Z"),
  ]);
  assert.equal(resolution.status, "AMBIGUOUS");
  if (resolution.status === "AMBIGUOUS") {
    assert.deepEqual(new Set(resolution.workspaceIds), new Set(["ws_a", "ws_b"]));
    assert.equal(resolution.reason, "ambiguous_platform_reply");
  }
}

// Unique match
{
  const resolution = resolvePlatformInboundReplyFromContexts([ctx("ws_a", "2026-09-24T10:00:00Z")]);
  assert.equal(resolution.status, "RESOLVED");
  if (resolution.status === "RESOLVED") {
    assert.equal(resolution.workspaceId, "ws_a");
  }
}

// Unmatched
{
  const resolution = resolvePlatformInboundReplyFromContexts([]);
  assert.equal(resolution.status, "UNMATCHED");
}

// Platform phone role marker
assert.equal(
  isPlatformMctbSenderPhoneRecord({
    settingsJson: platformMctbSenderSettings({ provider: "twilio" }),
  }),
  true,
);
assert.equal(
  isPlatformMctbSenderPhoneRecord({
    settingsJson: platformMctbSenderSettings({ provider: "telnyx" }),
  }),
  true,
);

// Generic inbound routing must not treat platform sender as a tenant-owned row
assert.equal(
  isMirrorOrArchivedPhoneRow({
    id: "pn_platform",
    workspaceId: "platform_owner",
    e164: "+18885046264",
    settingsJson: platformMctbSenderSettings(),
  }),
  true,
);

// Provider settings are not Twilio-hardcoded in business logic (Telnyx-capable resource shape)
const telnyxPlatform = platformMctbSenderSettings({ provider: "telnyx", tfvApproved: true });
assert.equal((telnyxPlatform.messagingCompliance as { type: string }).type, "A2P_10DLC");

console.log("test:mctb-platform-sender ok");
