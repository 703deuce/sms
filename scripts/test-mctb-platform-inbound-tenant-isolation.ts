/**
 * Synthetic tenant isolation + ambiguity for platform inbound resolver (no LLM guessing).
 * Run: npx tsx scripts/test-mctb-platform-inbound-tenant-isolation.ts
 */
import assert from "node:assert/strict";
import {
  resolvePlatformInboundReplyFromContexts,
  type PlatformMctbReplyContext,
} from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";

function ctx(
  workspaceId: string,
  conversationId: string,
  iso: string,
): PlatformMctbReplyContext {
  return {
    workspaceId,
    conversationId,
    lastOutboundAt: new Date(iso),
  };
}

// PART 12 — customer A must resolve alone (simulated contexts from outbound evidence)
{
  const resolution = resolvePlatformInboundReplyFromContexts([
    ctx("ws_customer_A", "conv_a", "2026-09-24T19:00:00Z"),
  ]);
  assert.equal(resolution.status, "RESOLVED");
  if (resolution.status === "RESOLVED") {
    assert.equal(resolution.workspaceId, "ws_customer_A");
    assert.notEqual(resolution.workspaceId, "ws_platform");
  }
}

// PART 13 — same consumer, two businesses on shared 888 → AMBIGUOUS (no recency pick)
{
  const resolution = resolvePlatformInboundReplyFromContexts([
    ctx("ws_customer_A", "conv_a", "2026-09-24T19:00:00Z"),
    ctx("ws_customer_B", "conv_b", "2026-09-24T19:05:00Z"),
  ]);
  assert.equal(resolution.status, "AMBIGUOUS");
  if (resolution.status === "AMBIGUOUS") {
    assert.equal(resolution.workspaceIds.length, 2);
    assert.deepEqual(new Set(resolution.workspaceIds), new Set(["ws_customer_A", "ws_customer_B"]));
  }
}

// Platform owner workspace must not appear unless it had qualifying outbound
{
  const resolution = resolvePlatformInboundReplyFromContexts([
    ctx("ws_customer_A", "conv_a", "2026-09-24T19:00:00Z"),
  ]);
  if (resolution.status === "RESOLVED") {
    assert.notEqual(resolution.workspaceId, "ws_platform");
  }
}

console.log("test-mctb-platform-inbound-tenant-isolation: ok");
