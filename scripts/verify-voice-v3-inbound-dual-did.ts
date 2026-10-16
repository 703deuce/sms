/**
 * Post-deploy verification: wizard + cert DIDs → Voice V3 worker + correct inbound agent.
 * Does not publish or mutate agent configuration.
 *
 * Run on production web container (LiveKit API + DB):
 *   WIZARD_E164=+15714073615 CERT_E164=+15717491060 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/verify-voice-v3-inbound-dual-did.ts
 */
import { VOICE_V3_LIVEKIT_AGENT_NAME } from "../src/lib/telephony/provisioning/config";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";
import {
  diagnoseLiveKitSipIssues,
  inspectLiveKitSipRouting,
} from "../src/lib/telephony/provisioning/livekit/inspect";

const WIZARD_E164 = (process.env.WIZARD_E164 || "+15714073615").trim();
const CERT_E164 = (process.env.CERT_E164 || "+15717491060").trim();
const EXPECTED_WIZARD_AGENT_ID = process.env.EXPECTED_WIZARD_AGENT_ID?.trim() || "";
const EXPECTED_CERT_AGENT_ID = process.env.EXPECTED_CERT_AGENT_ID?.trim() || "";

type Row = {
  check: string;
  e164: string;
  status: "PASS" | "FAIL";
  detail: string;
};

const rows: Row[] = [];

function pass(check: string, e164: string, detail: string) {
  rows.push({ check, e164, status: "PASS", detail });
}

function fail(check: string, e164: string, detail: string) {
  rows.push({ check, e164, status: "FAIL", detail });
}

async function verifyDid(e164: string, label: string, expectedAgentId?: string) {
  const routing = await resolveAgentByCalledNumber(e164);
  if (!routing) {
    fail("called_number_resolution", e164, `${label}: no inbound agent`);
  } else {
    const agentOk = !expectedAgentId || routing.agentId === expectedAgentId;
    if (agentOk) {
      pass(
        "called_number_resolution",
        e164,
        `${label}: agentId=${routing.agentId} phoneNumberId=${routing.phoneNumberId}`,
      );
    } else {
      fail(
        "called_number_resolution",
        e164,
        `${label}: expected agentId=${expectedAgentId} got ${routing.agentId}`,
      );
    }
  }

  const inspect = await inspectLiveKitSipRouting(e164);
  const dispatchAgents = [
    ...new Set(
      (inspect.dispatchRulesForTrunk.length
        ? inspect.dispatchRulesForTrunk
        : inspect.dispatchRules
      )
        .map((r) => r.agentName)
        .filter(Boolean),
    ),
  ];
  if (dispatchAgents.length === 0) {
    fail("sip_dispatch_agent", e164, "no dispatch rules with agentName");
  } else if (
    dispatchAgents.every((a) => a === VOICE_V3_LIVEKIT_AGENT_NAME)
  ) {
    pass(
      "sip_dispatch_agent",
      e164,
      `agentName=${VOICE_V3_LIVEKIT_AGENT_NAME} (${dispatchAgents.length} rule(s))`,
    );
  } else {
    fail(
      "sip_dispatch_agent",
      e164,
      `unexpected agentName(s): ${dispatchAgents.join(", ")} — must be ${VOICE_V3_LIVEKIT_AGENT_NAME}`,
    );
  }

  const issues = diagnoseLiveKitSipIssues(inspect, e164);
  const legacyIssues = issues.filter((i) => i.includes("legacy_worker"));
  if (legacyIssues.length) {
    fail("sip_dispatch_legacy", e164, legacyIssues.join("; "));
  } else if (issues.length) {
    fail("sip_routing_health", e164, issues.join("; "));
  } else {
    pass("sip_routing_health", e164, "trunk + dispatch OK");
  }
}

async function main() {
  console.log(
    JSON.stringify({
      event: "voice_v3_inbound_verify_start",
      wizardE164: WIZARD_E164,
      certE164: CERT_E164,
      expectedV3Worker: VOICE_V3_LIVEKIT_AGENT_NAME,
    }),
  );

  await verifyDid(WIZARD_E164, "wizard", EXPECTED_WIZARD_AGENT_ID || undefined);
  await verifyDid(CERT_E164, "cert", EXPECTED_CERT_AGENT_ID || undefined);

  const failed = rows.filter((r) => r.status === "FAIL");
  console.log("\n--- Voice V3 inbound verification ---\n");
  for (const r of rows) {
    console.log(`${r.status.padEnd(4)} | ${r.check.padEnd(28)} | ${r.e164} | ${r.detail}`);
  }
  console.log(
    `\nSummary: ${rows.length - failed.length}/${rows.length} checks passed` +
      (failed.length ? ` — ${failed.length} FAIL` : ""),
  );

  if (failed.length) {
    console.error(
      JSON.stringify({
        event: "voice_v3_inbound_verify_failed",
        failures: failed,
        hint:
          "Re-sync LiveKit dispatch for each DID (publish receptionist or dispatch metadata sync). Legacy transovo-voice-runtime is not registered — misrouted calls will not reach any worker.",
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      event: "voice_v3_inbound_verify_pass",
      note:
        "Routing checks passed. Confirm on a real PSTN call: voiceV3Forensics, gpt-live-1, published version for called DID.",
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
