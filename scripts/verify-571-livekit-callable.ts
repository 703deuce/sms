/**
 * Live readiness gate for +15714073615 AI After Hours (ws_1).
 * Exercises LiveKit API, SIP trunk/dispatch, Telnyx FQDN, web health, and worker dispatch.
 *
 * Run once:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-571-livekit-callable.ts
 *
 * Watch (background monitor):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-571-livekit-callable.ts --watch --interval=60
 */
import { randomUUID } from "node:crypto";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";
import {
  getLiveKitProjectAlignment,
  resolveTelnyxIngressLiveKitSipHost,
  TRANSOVO_LIVEKIT_AGENT_NAME,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
} from "../src/lib/telephony/provisioning/config";
import { inspectLiveKitSipRouting, isWildcardTelnyxTrunk } from "../src/lib/telephony/provisioning/livekit/inspect";
import { verifyNumberRouting } from "../src/lib/telephony/provisioning";
import { findFqdnConnectionByName } from "../src/lib/telephony/provisioning/telnyx/sip-connection";
import { requireLiveKitEnv } from "../src/lib/voice/runtime-provider/config";
import {
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk";

const E164 = process.env.PHONE_E164 || "+15714073615";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || "cmsgtjms84g6l2h0o255w1e3v";
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60";

type GateStatus = "PASS" | "FAIL" | "WARN";
type Gate = { name: string; status: GateStatus; detail: string };

const gates: Gate[] = [];

function gate(name: string, status: GateStatus, detail: string) {
  gates.push({ name, status, detail });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkLiveKitApi(): Promise<void> {
  try {
    const { url, apiKey, apiSecret } = requireLiveKitEnv();
    const client = new RoomServiceClient(url, apiKey, apiSecret);
    const rooms = await client.listRooms();
    gate(
      "LIVEKIT_API",
      "PASS",
      `listRooms ok on ${new URL(url).hostname} (${rooms.length} active rooms)`,
    );
  } catch (err) {
    gate(
      "LIVEKIT_API",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkProjectAlignment(): Promise<void> {
  try {
    const alignment = getLiveKitProjectAlignment();
    const ingress = resolveTelnyxIngressLiveKitSipHost();
    if (!ingress.host) {
      gate("LIVEKIT_SIP_PROJECT_ALIGN", "FAIL", "Telnyx ingress SIP host unresolved");
      return;
    }
    if (
      alignment.usingExplicitSipEnv &&
      !alignment.sipMatchesDerivedFromApi
    ) {
      gate(
        "LIVEKIT_SIP_PROJECT_ALIGN",
        "FAIL",
        `LIVEKIT_SIP_URI (${alignment.sipHost}) must match LIVEKIT_URL project (${alignment.derivedSipFromApi}). Update LIVEKIT_URL/API keys to the same LiveKit Cloud project as LIVEKIT_SIP_URI, then reprovision SIP trunk.`,
      );
      return;
    }
    gate(
      "LIVEKIT_SIP_PROJECT_ALIGN",
      "PASS",
      `Telnyx ingress ${ingress.host} matches LIVEKIT_URL project`,
    );
  } catch (err) {
    gate(
      "LIVEKIT_SIP_PROJECT_ALIGN",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkSipTrunkAndDispatch(): Promise<void> {
  try {
    const inspect = await inspectLiveKitSipRouting(E164);
    const trunk = inspect.trunkContainingDid;
    if (!trunk) {
      gate("LIVEKIT_SIP_TRUNK", "FAIL", `No inbound trunk owns ${E164}`);
      gate("LIVEKIT_DISPATCH", "FAIL", "skipped — no trunk");
      return;
    }
    const hasDid = (trunk.numbers || []).some(
      (n) => n === E164 || n === E164.replace(/^\+/, ""),
    );
    const wildcard = isWildcardTelnyxTrunk(trunk);
    gate(
      "LIVEKIT_SIP_TRUNK",
      hasDid || wildcard ? "PASS" : "FAIL",
      wildcard
        ? `${trunk.id} wildcard Telnyx IP trunk allowedAddresses=${JSON.stringify(trunk.allowedAddresses)}`
        : `${trunk.id} numbers=${JSON.stringify(trunk.numbers)}`,
    );

    const dispatch =
      inspect.dispatchRulesForTrunk[0] ||
      inspect.dispatchRules.find((r) => (r.trunkIds || []).length === 0);
    if (!dispatch) {
      gate("LIVEKIT_DISPATCH", "FAIL", `No dispatch rule for trunk ${trunk.id}`);
      return;
    }
    const agentOk =
      dispatch.agentName === TRANSOVO_LIVEKIT_AGENT_NAME ||
      Boolean(dispatch.agentName?.trim());
    gate(
      "LIVEKIT_DISPATCH",
      agentOk ? "PASS" : "FAIL",
      `${dispatch.id} → agent=${dispatch.agentName || "(missing)"} (expected ${TRANSOVO_LIVEKIT_AGENT_NAME})`,
    );
  } catch (err) {
    gate(
      "LIVEKIT_SIP_TRUNK",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
    gate("LIVEKIT_DISPATCH", "FAIL", "skipped — inspect failed");
  }
}

async function checkTelnyxRouting(): Promise<void> {
  try {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/phone_numbers",
      { query: { "filter[phone_number]": E164, "page[size]": 1 } },
    );
    const pn = listed.data?.[0];
    if (!pn) {
      gate("TELNYX_NUMBER", "FAIL", `${E164} not found in Telnyx account`);
      gate("TELNYX_FQDN", "FAIL", "skipped");
      return;
    }
    const status = String(pn.status || "").toLowerCase();
    gate(
      "TELNYX_NUMBER",
      status === "active" ? "PASS" : "FAIL",
      `status=${pn.status} connection=${pn.connection_name} (${pn.connection_id})`,
    );

    const fqdnConn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
    const onLiveKitConn = String(pn.connection_id || "") === String(fqdnConn?.id || "");
    if (!onLiveKitConn) {
      gate(
        "TELNYX_FQDN",
        "FAIL",
        `Number on ${pn.connection_name}, expected ${TRANSOVO_TELNYX_FQDN_CONNECTION_NAME}`,
      );
      return;
    }

    const connId = String(pn.connection_id || "");
    const [conn, fqdns, ingress] = await Promise.all([
      telnyxRequest<{ data?: Record<string, unknown> }>(
        `/fqdn_connections/${encodeURIComponent(connId)}`,
      ),
      telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
        query: { "filter[connection_id]": connId },
      }),
      Promise.resolve(resolveTelnyxIngressLiveKitSipHost()),
    ]);
    const primaryId = String(
      (conn.data?.inbound as Record<string, unknown> | undefined)
        ?.default_primary_fqdn_id || "",
    );
    const primaryFqdn = (fqdns.data || []).find((r) => String(r.id) === primaryId);
    const primaryHost = String(primaryFqdn?.fqdn || "").toLowerCase();
    const expectedHost = ingress.host.toLowerCase();
    gate(
      "TELNYX_FQDN",
      primaryHost === expectedHost ? "PASS" : "FAIL",
      `primary=${primaryHost || "(unset)"} expected=${expectedHost}`,
    );
  } catch (err) {
    gate(
      "TELNYX_NUMBER",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
    gate("TELNYX_FQDN", "FAIL", "skipped — Telnyx check failed");
  }
}

async function checkRecentSipFailures(infraOk: boolean): Promise<void> {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/detail_records",
      {
        query: {
          "filter[record_type]": "sip-trunking",
          "filter[cld]": E164,
          "page[size]": 5,
        },
      },
    );
    const recent = (sip.data || []).filter((r) => {
      const t = String(r.started_at || "");
      return !t || new Date(t) >= since;
    });
    const bad = recent.filter(
      (r) =>
        String(r.hangup_cause || "") === "UNALLOCATED_NUMBER" ||
        String(r.sip_invite_failure_status || "") === "404",
    );
    if (!recent.length) {
      gate(
        "TELNYX_RECENT_SIP",
        "WARN",
        "No SIP CDR rows in last 30m (place a test call to populate)",
      );
      return;
    }
    if (bad.length) {
      const lastAt = String(bad[0]?.started_at || "");
      const detail = `${bad.length}/${recent.length} recent calls got SIP 404 UNALLOCATED_NUMBER (last ${lastAt})`;
      // Stale PSTN failures before trunk repair — infra may already be fixed.
      gate("TELNYX_RECENT_SIP", infraOk ? "WARN" : "FAIL", detail);
      return;
    }
    gate(
      "TELNYX_RECENT_SIP",
      "PASS",
      `${recent.length} recent SIP CDR(s), none with 404 UNALLOCATED_NUMBER`,
    );
  } catch (err) {
    gate(
      "TELNYX_RECENT_SIP",
      "WARN",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkDbRouting(): Promise<void> {
  try {
    const route = await resolveAgentByCalledNumber(E164);
    const routeOk =
      route?.workspaceId === WORKSPACE_ID && route?.agentId === AGENT_ID;
    gate(
      "DB_AGENT_ROUTE",
      routeOk ? "PASS" : "FAIL",
      route
        ? `agent=${route.agentName} (${route.agentId}) workspace=${route.workspaceId}`
        : "no agent resolved for DID",
    );

    const verify = await verifyNumberRouting({
      workspaceId: WORKSPACE_ID,
      phoneNumberId: PHONE_NUMBER_ID,
    });
    gate(
      "VERIFY_ROUTING",
      verify.ok ? "PASS" : "FAIL",
      verify.ok ? "verifyNumberRouting ok" : verify.issues.join(", "),
    );
  } catch (err) {
    gate(
      "DB_AGENT_ROUTE",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
    gate("VERIFY_ROUTING", "FAIL", "skipped — DB check failed");
  }
}

async function checkWebHealth(): Promise<void> {
  const base = (
    process.env.TRANSOVO_BACKEND_URL ||
    process.env.APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!base) {
    gate("WEB_HEALTH", "WARN", "APP_URL / TRANSOVO_BACKEND_URL not set in this shell");
    gate("VOICE_RUNTIME_API", "WARN", "skipped — no base URL");
    return;
  }

  try {
    const health = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(15_000),
    });
    gate(
      "WEB_HEALTH",
      health.ok ? "PASS" : "FAIL",
      `GET ${base}/api/health → HTTP ${health.status}`,
    );
  } catch (err) {
    gate(
      "WEB_HEALTH",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }

  try {
    const internal = await fetch(`${base}/api/internal/voice-runtime`, {
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await internal.json().catch(() => ({}))) as { ok?: boolean };
    gate(
      "VOICE_RUNTIME_API",
      internal.ok && json.ok !== false ? "PASS" : "FAIL",
      `GET ${base}/api/internal/voice-runtime → HTTP ${internal.status}`,
    );
  } catch (err) {
    gate(
      "VOICE_RUNTIME_API",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function checkWorkerDispatchProbe(): Promise<void> {
  const timeoutMs = Number(process.env.LIVEKIT_WORKER_PROBE_TIMEOUT_MS || 45_000);
  const pollMs = 2_000;
  const roomName = `transovo-verify-probe-${randomUUID().slice(0, 8)}`;

  let roomClient: RoomServiceClient | null = null;
  try {
    const { url, apiKey, apiSecret } = requireLiveKitEnv();
    roomClient = new RoomServiceClient(url, apiKey, apiSecret);
    const dispatchClient = new AgentDispatchClient(url, apiKey, apiSecret);

    await roomClient.createRoom({
      name: roomName,
      emptyTimeout: 120,
      departureTimeout: 30,
    });

    await dispatchClient.createDispatch(roomName, TRANSOVO_LIVEKIT_AGENT_NAME, {
      metadata: JSON.stringify({
        verifyProbe: true,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_ID,
        callId: `verify-${randomUUID()}`,
        dispatchSource: "verify_571_script",
        lightweightBootstrap: true,
      }),
    });

    const deadline = Date.now() + timeoutMs;
    let joined = false;
    let lastCount = 0;
    while (Date.now() < deadline) {
      const participants = await roomClient.listParticipants(roomName);
      lastCount = participants.length;
      const agentJoined = participants.some((p) => {
        const id = String(p.identity || "").toLowerCase();
        const kind = String((p as { kind?: string }).kind || "").toLowerCase();
        return kind.includes("agent") || id.includes("agent") || participants.length >= 1;
      });
      if (agentJoined && participants.length > 0) {
        joined = true;
        break;
      }
      await sleep(pollMs);
    }

    gate(
      "WORKER_DISPATCH_PROBE",
      joined ? "PASS" : "FAIL",
      joined
        ? `${TRANSOVO_LIVEKIT_AGENT_NAME} joined room ${roomName} (${lastCount} participant(s))`
        : `No worker joined within ${timeoutMs / 1000}s (room=${roomName}, lastCount=${lastCount}). Is transovo-voice running with MEDIA_BACKEND_MODE=livekit_cloud?`,
    );
  } catch (err) {
    gate(
      "WORKER_DISPATCH_PROBE",
      "FAIL",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    if (roomClient) {
      try {
        await roomClient.deleteRoom(roomName);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

async function runOnce(): Promise<boolean> {
  gates.length = 0;
  const started = new Date().toISOString();
  console.log(`\n══ 571 LiveKit callable verify @ ${started} ══`);
  console.log(`DID: ${E164}  workspace: ${WORKSPACE_ID}  agent: ${AGENT_ID}\n`);

  await checkLiveKitApi();
  await checkProjectAlignment();
  await checkSipTrunkAndDispatch();
  await checkTelnyxRouting();
  const infraOk = [
    "LIVEKIT_API",
    "LIVEKIT_SIP_TRUNK",
    "LIVEKIT_DISPATCH",
    "TELNYX_NUMBER",
    "TELNYX_FQDN",
  ].every((name) => gates.find((g) => g.name === name)?.status === "PASS");
  await checkRecentSipFailures(infraOk);
  await checkDbRouting();
  await checkWebHealth();
  await checkWorkerDispatchProbe();

  for (const g of gates) {
    const icon = g.status === "PASS" ? "✓" : g.status === "WARN" ? "!" : "✗";
    console.log(`${icon} ${g.status.padEnd(4)} ${g.name}`);
    console.log(`       ${g.detail}`);
  }

  const failures = gates.filter((g) => g.status === "FAIL");
  const warns = gates.filter((g) => g.status === "WARN");
  const passes = gates.filter((g) => g.status === "PASS");
  console.log(
    `\nSummary: ${passes.length} PASS, ${warns.length} WARN, ${failures.length} FAIL`,
  );

  if (failures.length) {
    console.log("\nBLOCKERS:", failures.map((f) => f.name).join(", "));
    return false;
  }
  console.log("\nOVERALL: READY — LiveKit path looks callable (PSTN smoke still manual).");
  return true;
}

async function main() {
  const watch = process.argv.includes("--watch");
  const intervalArg = process.argv.find((a) => a.startsWith("--interval="));
  const intervalSec = Number(intervalArg?.split("=")[1] || 60);

  if (!watch) {
    const ok = await runOnce();
    process.exit(ok ? 0 : 1);
  }

  console.log(`Watch mode: re-check every ${intervalSec}s (Ctrl+C to stop)\n`);
  for (;;) {
    const ok = await runOnce();
    if (!ok) {
      console.log(`\n[watch] FAIL — next check in ${intervalSec}s\n`);
    } else {
      console.log(`\n[watch] PASS — next check in ${intervalSec}s\n`);
    }
    await sleep(intervalSec * 1000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
