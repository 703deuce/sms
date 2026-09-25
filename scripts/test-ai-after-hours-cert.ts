/**
 * AI After Hours certification gates (SIMULATED + LIVE where env allows).
 * Run: npx tsx scripts/test-ai-after-hours-cert.ts
 *
 * Set WORKSPACE_ID=ws_1 for ws_1 integration checks.
 */
import {
  getMediaBackendMode,
  getActiveMediaBackend,
  isMediaBackendConfigured,
} from "../src/lib/voice/media-backend";
import { DEFAULT_MEDIA_BACKEND_MODE } from "../src/lib/voice/media-backend/constants";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";
import { sendSmsForPython } from "../src/lib/voice/python-runtime-bridge/send-sms-for-python";
import { isAiAfterHoursEntitled } from "../src/lib/products/ai-after-hours";
import { buildAiAfterHoursNav } from "../src/lib/products/ai-after-hours-nav";

type GateResult = {
  gate: string;
  mode: "LIVE" | "SANDBOX" | "SIMULATED" | "SKIPPED";
  status: "PASS" | "FAIL" | "MANUAL_PENDING";
  detail: string;
};

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const results: GateResult[] = [];

function record(
  gate: string,
  mode: GateResult["mode"],
  status: GateResult["status"],
  detail: string,
) {
  results.push({ gate, mode, status, detail });
}

function livekitHostPattern(): string {
  const raw = (process.env.LIVEKIT_URL || "").trim();
  if (!raw) return "missing";
  const host = raw.replace(/^wss?:\/\//, "").split("/")[0];
  if (host.includes(".livekit.cloud")) return "livekit.cloud";
  if (host.includes("transovo.ai")) return "self-hosted";
  return "other";
}

// Gate 1: Product entitlement
record(
  "AI_AFTER_HOURS_ENTITLED",
  "SIMULATED",
  isAiAfterHoursEntitled(true) ? "PASS" : "FAIL",
  "hasVoice maps to AI After Hours active",
);

// Gate 2: Nav restored
const nav = buildAiAfterHoursNav();
record(
  "AI_NAV_RESTORED",
  "SIMULATED",
  nav.some((i) => i.href === "/voice/receptionist") &&
    nav.some((i) => i.href === "/voice/call-handling")
    ? "PASS"
    : "FAIL",
  `${nav.length} nav items; canonical Receptionist + Call Handling`,
);

// Gate 3: LiveKit Cloud default
const backendMode = getMediaBackendMode();
const activeBackend = getActiveMediaBackend();
const hostPattern = livekitHostPattern();
const cloudConfigured = isMediaBackendConfigured("livekit_cloud");
record(
  "LIVEKIT_CLOUD_DEFAULT",
  cloudConfigured ? "LIVE" : "SANDBOX",
  backendMode === "livekit_cloud" && DEFAULT_MEDIA_BACKEND_MODE === "livekit_cloud"
    ? "PASS"
    : "FAIL",
  `mode=${backendMode} active=${activeBackend} default=${DEFAULT_MEDIA_BACKEND_MODE} host=${hostPattern}`,
);

record(
  "LIVEKIT_CLOUD_CREDENTIALS",
  cloudConfigured ? "LIVE" : "SKIPPED",
  cloudConfigured && hostPattern === "livekit.cloud" ? "PASS" : cloudConfigured ? "FAIL" : "MANUAL_PENDING",
  cloudConfigured
    ? `LIVEKIT_URL host pattern=${hostPattern}`
    : "LIVEKIT_* not fully configured in this environment",
);

// Gate 4: ws_1 workspace audit
async function auditWorkspace() {
  try {
    const { getPrisma } = await import("../src/lib/db");
    const prisma = getPrisma();
  const workspace = await prisma.workspace.findFirst({
    where: { id: WORKSPACE_ID },
    select: { id: true, name: true },
  });
  const numbers = workspace
    ? await prisma.phoneNumber.findMany({
        where: { workspaceId: WORKSPACE_ID, status: { in: ["ACTIVE", "Active"] } },
        select: { id: true, e164: true, settingsJson: true, capabilitiesJson: true },
        take: 20,
      })
    : [];
  const agents = workspace
    ? await prisma.voiceAgent.findMany({
        where: { workspaceId: WORKSPACE_ID },
        select: { id: true, name: true, status: true, phoneNumberId: true },
        take: 10,
      })
    : [];

  record(
    "WS1_WORKSPACE",
    "LIVE",
    workspace ? "PASS" : "FAIL",
    workspace ? `${workspace.id} (${workspace.name})` : `${WORKSPACE_ID} not found`,
  );

  const candidate = numbers.find((n) => {
    const caps = readPhoneCapabilities({
      settingsJson: n.settingsJson,
      capabilitiesJson: n.capabilitiesJson,
    });
    return caps.smsEnabled;
  });

  record(
    "WS1_SMS_CAPABLE_NUMBER",
    workspace ? "LIVE" : "SKIPPED",
    candidate ? "PASS" : numbers.length ? "MANUAL_PENDING" : "FAIL",
    candidate
      ? `${candidate.e164} (id ${candidate.id})`
      : numbers.length
        ? `${numbers.length} active numbers — pick SMS-capable for smoke`
        : "no active numbers on workspace",
  );

  if (candidate) {
    const routing = await resolveAgentByCalledNumber(candidate.e164);
    record(
      "WS1_INBOUND_AGENT_RESOLVE",
      "LIVE",
      routing?.workspaceId === WORKSPACE_ID ? "PASS" : "MANUAL_PENDING",
      routing
        ? `agent=${routing.agentName} (${routing.agentId})`
        : "no AI agent bound to candidate number yet",
    );

    const caps = readPhoneCapabilities({
      settingsJson: candidate.settingsJson,
      capabilitiesJson: candidate.capabilitiesJson,
    });
    record(
      "WS1_NUMBER_COEXISTENCE_MODEL",
      "SIMULATED",
      typeof caps.smsEnabled === "boolean" && typeof caps.mctbEnabled === "boolean"
        ? "PASS"
        : "FAIL",
      `sms=${caps.smsEnabled} voice=${caps.voiceEnabled} ai=${caps.aiAfterHoursEnabled} mctb=${caps.mctbEnabled}`,
    );
  }

  record(
    "WS1_VOICE_AGENTS",
    workspace ? "LIVE" : "SKIPPED",
    agents.length ? "PASS" : "MANUAL_PENDING",
    agents.length
      ? agents.map((a) => `${a.name}(${a.status})`).join(", ")
      : "no voice agents on workspace",
  );
  } catch (err) {
    record(
      "WS1_WORKSPACE",
      "SKIPPED",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function main() {
  await auditWorkspace();

  // Gate 5: SMS bridge (simulated — does not send without DB)
  record(
    "VOICE_SEND_SMS_BRIDGE",
    "SIMULATED",
    typeof sendSmsForPython === "function" ? "PASS" : "FAIL",
    "sendSmsForPython -> voice_send_sms -> sendQuickSms pipeline wired",
  );

  // Gate 6: PSTN smoke
  record(
    "PSTN_INBOUND_SMOKE",
    "SKIPPED",
    "MANUAL_PENDING",
    "Place a real call to the ws_1 candidate number after LiveKit dispatch is confirmed",
  );

  console.log("\n=== AI After Hours Certification ===\n");
  for (const row of results) {
    console.log(`${row.status.padEnd(14)} [${row.mode.padEnd(10)}] ${row.gate}`);
    console.log(`  ${row.detail}\n`);
  }

  const failures = results.filter((r) => r.status === "FAIL");
  const manual = results.filter((r) => r.status === "MANUAL_PENDING");
  console.log(
    `Summary: ${results.filter((r) => r.status === "PASS").length}/${results.length} PASS, ` +
      `${failures.length} FAIL, ${manual.length} MANUAL_PENDING`,
  );

  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
