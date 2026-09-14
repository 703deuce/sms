#!/usr/bin/env npx tsx
/**
 * Regression: resolveToolWebhookContext must not throw when callId + callControlId are set.
 */
import { resolveToolWebhookContext } from "../src/lib/voice/tools/tool-webhook-context";

async function main() {
  const headers = new Headers({
    "x-transovo-workspace-id": "ws_1",
    "x-transovo-agent-id": "cmshz2lc25c622c4i58303501",
    "x-transovo-tool-type": "voice_ai_booking_turn",
    "x-telnyx-call-control-id": "v3:test-control-id-for-prisma-regression",
  });
  const request = { headers } as Request;
  const body = { utterance: "book tomorrow" };

  const result = await resolveToolWebhookContext({
    request,
    body,
    workspaceId: "ws_1",
    agentId: "cmshz2lc25c622c4i58303501",
    toolType: "voice_ai_booking_turn",
    ingressStartedAt: Date.now(),
  });

  if ("ok" in result && result.ok === false) {
    console.log("test-tool-webhook-context-prisma: ok (structured error, no throw)", result.result);
    return;
  }
  if ("callId" in result) {
    console.log("test-tool-webhook-context-prisma: ok", { callId: result.callId });
    return;
  }
  throw new Error("unexpected result shape");
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
