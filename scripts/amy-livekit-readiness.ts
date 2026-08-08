/**
 * Amy + LiveKit production readiness (presence-only — no secret values printed).
 * Run: npx tsx scripts/amy-livekit-readiness.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  getVoiceRuntimeProviderId,
  requireLiveKitEnv,
} from "../src/lib/voice/runtime-provider/config";
import { resolveLiveKitSipHost } from "../src/lib/telephony/provisioning/config";

const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_866_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();

function presence(name: string): "SET" | "MISSING" {
  return process.env[name]?.trim() ? "SET" : "MISSING";
}

function elevenLabsPresent(): boolean {
  return Boolean(
    process.env.ELEVENLABS_API_KEY?.trim() || process.env.ELEVENLABS_KEY?.trim(),
  );
}

async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return { ok: true, detail: "connected" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<{ ok: boolean; detail: string }> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return { ok: false, detail: "REDIS_URL missing (optional for dev)" };
  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
    await client.ping();
    await client.quit();
    return { ok: true, detail: "ping ok" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkLiveKitApi(): Promise<{ ok: boolean; detail: string }> {
  try {
    const { url, apiKey, apiSecret } = requireLiveKitEnv();
    const { RoomServiceClient } = await import("livekit-server-sdk");
    const client = new RoomServiceClient(url, apiKey, apiSecret);
    await client.listRooms();
    return { ok: true, detail: "listRooms ok" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkTelnyxNumber(e164: string): Promise<Record<string, unknown>> {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) return { ok: false, error: "TELNYX_API_KEY missing" };

  const res = await fetch(
    `https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      connection_name?: string;
      connection_id?: string;
      status?: string;
    }>;
  };
  if (!res.ok) return { ok: false, status: res.status, body: json };

  const row = json.data?.[0];
  if (!row) return { ok: false, error: "number not found in Telnyx account" };

  let connectionDetail: Record<string, unknown> | null = null;
  if (row.connection_id) {
    for (const path of [
      `/texml_applications/${encodeURIComponent(row.connection_id)}`,
      `/call_control_applications/${encodeURIComponent(row.connection_id)}`,
      `/connections/${encodeURIComponent(row.connection_id)}`,
    ]) {
      try {
        const cRes = await fetch(`https://api.telnyx.com/v2${path}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (cRes.ok) {
          const cJson = (await cRes.json()) as { data?: Record<string, unknown> };
          connectionDetail = cJson.data || null;
          if (connectionDetail) break;
        }
      } catch {
        // try next
      }
    }
  }

  const connName = String(row.connection_name || connectionDetail?.application_name || "");
  const routeKind = /texml|ai direct/i.test(connName)
    ? "telnyx_texml_assistant"
    : /sip|fqdn|livekit/i.test(connName)
      ? "sip_to_livekit_candidate"
      : "unknown";

  let voice: Record<string, unknown> | null = null;
  try {
    const vRes = await fetch(
      `https://api.telnyx.com/v2/phone_numbers/${encodeURIComponent(row.id)}/voice`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    voice = (await vRes.json()) as Record<string, unknown>;
  } catch {
    voice = null;
  }

  return {
    ok: true,
    telnyxNumberId: row.id,
    connectionId: row.connection_id,
    connectionName: row.connection_name,
    routeKind,
    status: row.status,
    voice,
  };
}

async function main() {
  const provider = getVoiceRuntimeProviderId();
  console.log("=== Amy LiveKit readiness ===\n");
  console.log(`Runtime provider: ${provider} (env VOICE_RUNTIME_PROVIDER: ${presence("VOICE_RUNTIME_PROVIDER")})`);

  console.log("\n--- Core env (presence only) ---");
  const core = [
    "DATABASE_URL",
    "APP_URL",
    "TELNYX_API_KEY",
    "REDIS_URL",
    "VOICE_RUNTIME_PROVIDER",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "LIVEKIT_AGENT_NAME",
    "LIVEKIT_SIP_HOST",
    "LIVEKIT_SIP_URI",
    "LIVEKIT_SIP_ENDPOINT",
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_KEY",
  ];
  for (const k of core) {
    if (k === "ELEVENLABS_API_KEY" || k === "ELEVENLABS_KEY") continue;
    console.log(`  ${k}: ${presence(k)}`);
  }
  console.log(`  ELEVENLABS (API_KEY or KEY): ${elevenLabsPresent() ? "SET" : "MISSING"}`);

  const sip = resolveLiveKitSipHost();
  if (sip.host) {
    const masked =
      sip.host.length > 12
        ? `${sip.host.slice(0, 8)}…${sip.host.slice(-18)}`
        : sip.host;
    console.log(`  LiveKit SIP host: SET via ${sip.source} (${masked})`);
  } else {
    console.log("  LiveKit SIP host: MISSING (need *.sip.livekit.cloud on LIVEKIT_URL or LIVEKIT_SIP_*)");
  }

  console.log("\n--- Connectivity ---");
  const db = await checkDatabase();
  console.log(`  Database: ${db.ok ? "OK" : "FAIL"} — ${db.detail}`);

  const redis = await checkRedis();
  console.log(`  Redis: ${redis.ok ? "OK" : "WARN"} — ${redis.detail}`);

  const lk = await checkLiveKitApi();
  console.log(`  LiveKit API: ${lk.ok ? "OK" : "FAIL"} — ${lk.detail}`);

  console.log("\n--- Amy agent (database) ---");
  const prisma = new PrismaClient();
  const agent = await prisma.voiceAgent.findUnique({ where: { id: AMY_AGENT_ID } });
  const pn866 =
    (await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } })) ||
    (agent?.phoneNumberId
      ? await prisma.phoneNumber.findUnique({ where: { id: agent.phoneNumberId } })
      : null);
  const ver = agent?.publishedVersionId
    ? await prisma.voiceAgentVersion.findUnique({ where: { id: agent.publishedVersionId } })
    : null;
  const cfg = (ver?.config || agent?.draftConfig || {}) as {
    enabledBuiltinTools?: string[];
  };
  const tools = cfg.enabledBuiltinTools || [];

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        agentId: AMY_AGENT_ID,
        agentName: agent?.name,
        agentStatus: agent?.status,
        telnyxAssistantId: agent?.telnyxAssistantId,
        publishedVersionId: agent?.publishedVersionId,
        phoneE164: pn866?.e164,
        phoneNumberId: agent?.phoneNumberId,
        runtime_turn_enabled: tools.includes("runtime_turn"),
        enabledBuiltinTools: tools,
      },
      null,
      2,
    ),
  );

  const e164 = pn866?.e164 || "+18663464256";
  console.log(`\n--- Telnyx routing for ${e164} ---`);
  const telnyx = await checkTelnyxNumber(e164);
  console.log(JSON.stringify(telnyx, null, 2));

  await prisma.$disconnect();

  console.log("\n--- Path diagnosis ---");
  const routeKind = String((telnyx as { routeKind?: string }).routeKind || "unknown");
  if (provider === "livekit") {
    console.log(
      "  LiveKit mode: inbound calls must hit Telnyx SIP → LiveKit dispatch → transovo-voice-runtime worker.",
    );
    if (routeKind === "telnyx_texml_assistant") {
      console.log(
        `  BLOCKER: +18663464256 is still on TeXML/Telnyx AI Assistant (${(telnyx as { connectionName?: string }).connectionName}). LiveKit worker will not receive these calls.`,
      );
    }
    if (!lk.ok) console.log("  BLOCKER: LiveKit API not reachable — fix LIVEKIT_* env and deploy worker.");
  } else {
    console.log(
      "  Telnyx mode: +18663464256 routes via TeXML → Telnyx AI Assistant → runtime_turn webhook.",
    );
    if (routeKind === "telnyx_texml_assistant") {
      console.log("  Number routing matches Telnyx assistant path (expected for current 866 setup).");
    }
    if (!tools.includes("runtime_turn")) {
      console.log("  BLOCKER: runtime_turn not in published tools — run scripts/fix-amy-runtime-turn-enabled.mjs");
    }
  }

  const blockers: string[] = [];
  if (!db.ok) blockers.push("database");
  if (provider === "livekit" && !lk.ok) blockers.push("livekit_api");
  if (!elevenLabsPresent()) blockers.push("elevenlabs");
  if (provider === "livekit" && presence("OPENAI_API_KEY") === "MISSING") {
    blockers.push("openai_api_key");
  }
  if (provider === "livekit" && routeKind === "telnyx_texml_assistant") {
    blockers.push("number_still_on_telnyx_assistant");
  }
  if (provider === "telnyx" && !tools.includes("runtime_turn")) {
    blockers.push("runtime_turn_disabled");
  }

  console.log(`\nOVERALL: ${blockers.length === 0 ? "READY (automated checks)" : `BLOCKED (${blockers.join(", ")})`}`);
  if (blockers.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
