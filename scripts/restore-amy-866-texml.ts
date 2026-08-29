/**
 * Emergency: route +18663464256 back to Amy via Telnyx TeXML assistant
 * (original working path — bypasses broken LiveKit SIP 404).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/restore-amy-866-texml.ts
 */
import { restoreTexmlInboundRoute } from "../src/lib/telephony/provisioning/number-assignment";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const E164 = process.env.PHONE_E164 || "+18663464256";

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const { publishVoiceAgent } = await import("../src/lib/voice/agent-service.ts");

  console.log("=== Restore Amy TeXML direct route on 866 ===");
  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });
  console.log(JSON.stringify(restored, null, 2));

  console.log("\n=== Publish Amy (Telnyx assistant sync) ===");
  const published = await publishVoiceAgent(WORKSPACE_ID, AMY_AGENT_ID, "restore-texml-866");
  console.log(
    JSON.stringify(
      {
        agent: published.agent.name,
        status: published.agent.status,
        telnyxAssistantId: published.agent.telnyxAssistantId,
        texmlRoute: published.texmlRoute,
      },
      null,
      2,
    ),
  );

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = listed.data?.[0];
  console.log("\n=== Telnyx number after restore ===");
  console.log(
    JSON.stringify(
      {
        connection_id: pn?.connection_id,
        connection_name: pn?.connection_name,
        status: pn?.status,
      },
      null,
      2,
    ),
  );

  if (!restored.ok) {
    process.exit(1);
  }
  console.log("\n=== READY — call +18663464256 (Amy via Telnyx TeXML) ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
