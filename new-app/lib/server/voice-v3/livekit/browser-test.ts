import "server-only";

import { randomUUID } from "node:crypto";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { getPrisma } from "@/lib/server/db";
import { getLiveKitSipClient, VOICE_V3_LIVEKIT_AGENT_NAME } from "@/lib/server/receptionist/livekit/client";
import { ensureWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";

const BROWSER_ROOM_PREFIX =
  process.env.LIVEKIT_BROWSER_TEST_ROOM_PREFIX?.trim() || "transovo-browser-test-";

function requireLiveKitEnv() {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)");
  }
  return { url, apiKey, apiSecret };
}

export async function createReceptionistBrowserLiveKitTest(input: {
  workspaceId: string;
  userId: string;
  version: "draft" | "live";
}) {
  const agent = await ensureWorkspaceReceptionistAgent(input.workspaceId);
  if (input.version === "live" && !agent.publishedVersionId) {
    return { ok: false as const, code: "not_published", error: "Publish before testing live configuration" };
  }

  const sessionId = randomUUID();
  const roomName = `${BROWSER_ROOM_PREFIX}${sessionId}`;
  const participantIdentity = `browser-${input.userId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  const { url, apiKey, apiSecret } = requireLiveKitEnv();

  const jobMetadata = {
    runtime: "voice_v3_gpt_live",
    resolve: "http_backend_on_sip",
    workspaceId: input.workspaceId,
    agentId: agent.id,
    publishedVersionId: input.version === "live" ? agent.publishedVersionId : undefined,
    browserTest: true,
    useDraft: input.version === "draft",
    dispatchSource: "browser_test",
  };

  const dispatchClient = new AgentDispatchClient(url, apiKey, apiSecret);
  await dispatchClient.createDispatch(roomName, VOICE_V3_LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify(jobMetadata),
  });

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    ttl: "15m",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  const jwt = await token.toJwt();

  return {
    ok: true as const,
    sessionId,
    roomName,
    participantIdentity,
    livekit: { url, token: jwt },
    agentId: agent.id,
    version: input.version,
  };
}

export async function verifyLiveKitProvisioningForPhone(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ ok: boolean; actions: string[]; error?: string }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { e164: true, settingsJson: true },
  });
  if (!phone?.e164) return { ok: false, actions: [], error: "phone_not_found" };

  const { readTelephonyProvision } = await import("@/lib/server/telephony/telephony-record");
  const provision = readTelephonyProvision(phone.settingsJson);
  const trunkId = provision.livekitInboundTrunkId;
  if (!trunkId) {
    return { ok: false, actions: ["missing_trunk"], error: "not_livekit_provisioned" };
  }

  try {
    const client = getLiveKitSipClient();
    const rules = await client.listSipDispatchRule();
    const { TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME } = await import(
      "@/lib/server/telephony/config"
    );
    const { VOICE_V3_LIVEKIT_AGENT_NAME } = await import("@/lib/server/receptionist/livekit/client");
    const match =
      rules.find((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME) ||
      rules.find((r) => r.roomConfig?.agents?.[0]?.agentName === VOICE_V3_LIVEKIT_AGENT_NAME);
    if (!match?.sipDispatchRuleId) {
      return { ok: false, actions: ["canonical_dispatch_missing"], error: "dispatch_rule_not_found" };
    }
    const agent = match.roomConfig?.agents?.[0]?.agentName;
    if (agent !== VOICE_V3_LIVEKIT_AGENT_NAME) {
      return {
        ok: false,
        actions: ["wrong_dispatch_agent", agent || "unknown"],
        error: "dispatch_targets_wrong_worker",
      };
    }
    return { ok: true, actions: ["canonical_dispatch_verified", match.sipDispatchRuleId] };
  } catch (err) {
    return {
      ok: false,
      actions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
