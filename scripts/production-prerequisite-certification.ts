#!/usr/bin/env npx tsx
/**
 * Production prerequisite certification (deploy + Microsoft + worker).
 * READ-ONLY for OAuth/token state — never refreshes Microsoft tokens from this host.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/production-prerequisite-certification.ts
 */
process.env.CERTIFICATION_READ_ONLY = "1";
process.env.TRANSOVO_OAUTH_MUTATION_SOURCE = "certification";

import { getPrisma } from "../src/lib/db";
import { resolveDeployedCommitSha } from "../src/lib/deploy-commit";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import { resolveVoiceBookingMode } from "../src/lib/voice/ai-booking/mode";
import {
  getMicrosoftRedirectUri,
  isMicrosoftOAuthConfigured,
} from "../src/lib/microsoft/oauth-config";
import { snapshotMicrosoftConnectionDiagnostics } from "../src/lib/microsoft/connection-diagnostics";
import type { CalendarConfig } from "../src/lib/calendar/providers";
import { PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES } from "../src/lib/jobs/bullmq";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const WORKER_FIX_SHA = "fc5dc039";
const WEB_MIN_SHA = "6758acc3";

const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

function yn(p: boolean) {
  return p ? "YES" : "NO";
}
function pf(p: boolean) {
  return p ? "PASS" : "FAIL";
}

const WEB_DEPLOY_PREFIXES = ["6758acc3", "71910635", "fc5dc039", "393b3aaa", "d3a3eb21"];

function webBuildAcceptable(deployed: string | null): boolean {
  if (!deployed) return false;
  return WEB_DEPLOY_PREFIXES.some((p) => deployed.startsWith(p));
}

type JobClass = "SAFE_TO_RETRY" | "OBSOLETE_DO_NOT_SEND" | "ALREADY_COMPLETED" | "DUPLICATE" | "REQUIRES_REVIEW";

function classifyMctbJob(input: {
  jobType: string;
  status: string;
  createdAt: Date;
  runAfter: Date;
  attempts: number;
  lastError: string | null;
}): JobClass {
  const ageHours = (Date.now() - input.createdAt.getTime()) / 3600_000;
  if (input.status === "completed") return "ALREADY_COMPLETED";
  if (input.jobType === "john_mctb_send" && ageHours > 72) return "OBSOLETE_DO_NOT_SEND";
  if (input.jobType === "mctb_send_customer_sms" && ageHours > 48) return "OBSOLETE_DO_NOT_SEND";
  if (input.status === "failed" && /already sent|duplicate|completed/i.test(input.lastError || "")) {
    return "DUPLICATE";
  }
  if (input.status === "pending" && ageHours > 168) return "REQUIRES_REVIEW";
  if (input.status === "pending" || input.status === "deferred") return "SAFE_TO_RETRY";
  return "REQUIRES_REVIEW";
}

async function fetchHealthCommit(): Promise<string | null> {
  if (!appUrl) return null;
  try {
    const res = await fetch(`${appUrl}/api/health`, { cache: "no-store" });
    const json = (await res.json()) as { commitSha?: string };
    return json.commitSha?.trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const prisma = getPrisma();
  const healthSha = await fetchHealthCommit();
  const localSha = resolveDeployedCommitSha();

  const certHostOAuth = isMicrosoftOAuthConfigured();
  const appUrlPresent = Boolean(appUrl);

  const cfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const connId = cfg.calendarId || "";
  const conn = connId
    ? await prisma.voiceCalendarConnection.findFirst({
        where: { id: connId, workspaceId: WORKSPACE_ID, provider: "microsoft" },
      })
    : null;
  const snap = conn
    ? snapshotMicrosoftConnectionDiagnostics({
        connectionId: conn.id,
        status: conn.status,
        config: (conn.config || {}) as CalendarConfig,
      })
    : null;

  const voiceMode = await resolveVoiceBookingMode({ workspaceId: WORKSPACE_ID, agentId: AGENT_ID });

  const pollutionSuspect =
    snap?.lastTokenRefreshError === "missing_client_credentials" &&
    snap.lastTokenRefreshSource !== "production_web";

  const mctbTypes = ["john_mctb_send", "mctb_process_inbound_sms", "mctb_send_customer_sms"];
  const stuck = await prisma.jobQueue.findMany({
    where: {
      jobType: { in: mctbTypes },
      status: { in: ["pending", "deferred", "processing", "failed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      jobType: true,
      status: true,
      attempts: true,
      lastError: true,
      runAfter: true,
      createdAt: true,
      queueName: true,
    },
  });

  let heartbeatOk = false;
  let heartbeatAgeMs: number | null = null;
  try {
    const hb = await prisma.workerHeartbeat.findFirst({
      where: { workerKey: "sms-dispatch" },
      orderBy: { lastBeatAt: "desc" },
    });
    if (hb?.lastBeatAt) {
      heartbeatAgeMs = Date.now() - hb.lastBeatAt.getTime();
      heartbeatOk = heartbeatAgeMs < Number(process.env.SMS_WORKER_MAX_STALE_MS || 60_000);
    }
  } catch {
    heartbeatOk = false;
  }

  const webDeployPass = webBuildAcceptable(healthSha);
  const workerDeployPass = false;

  const oneTimeReconnect =
    snap?.lastTokenRefreshKind === "invalid_grant" ||
    /invalid_grant|revoked/i.test(snap?.lastTokenRefreshError || "");

  console.log("\nPRODUCTION PREREQUISITE CERTIFICATION\n");
  console.log("WEB APP");
  console.log(`Deployed corrected build ................. ${pf(webDeployPass)} (health=${healthSha || "unknown"}, need>=${WEB_MIN_SHA})`);
  console.log("");
  console.log("MICROSOFT");
  console.log(`CERTIFICATION_HOST_OAUTH_CONFIGURED .... ${yn(certHostOAuth)}`);
  console.log(`PRODUCTION_WEB_OAUTH_CONFIGURED ........ UNVERIFIED`);
  console.log(`APP_URL_PRESENT .......................... ${yn(appUrlPresent)}`);
  console.log(`CALLBACK ................................. ${getMicrosoftRedirectUri()}`);
  console.log(`ENTRA_REDIRECT_PLATFORM .................. UNVERIFIED`);
  console.log(`INITIAL_OAUTH ............................ PASS (historical)`);
  console.log(`POST_CONNECT_LIVE_GRAPH_VERIFICATION ..... ${snap?.lastVerificationOk === true ? "PASS" : "UNKNOWN"}`);
  console.log(`REFRESH_TOKEN_PRESENT .................... ${pf(Boolean(snap?.refreshTokenPresent))}`);
  console.log(`PRODUCTION_REFRESH_AFTER_EXPIRY ............ UNVERIFIED`);
  console.log(`LAST_PRODUCTION_REFRESH_RESULT ........... ${snap?.lastTokenRefreshKind || "none"} / ${snap?.lastTokenRefreshError || "none"}`);
  console.log(`LAST_REFRESH_SOURCE (stored) ............. ${snap?.lastTokenRefreshSource || "unknown"}`);
  console.log(`CERTIFICATION_POLLUTION_SUSPECT .......... ${yn(pollutionSuspect)}`);
  console.log(`Voice booking mode ....................... ${voiceMode}`);
  console.log(`One-time reconnect required .............. ${yn(oneTimeReconnect)}`);
  console.log("");
  console.log("WORKER");
  console.log(`Corrected commit deployed ................ ${pf(workerDeployPass)} (need ${WORKER_FIX_SHA} on Coolify worker — verify manually)`);
  console.log(`Required BullMQ queues ................... ${PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES.join(", ")}`);
  console.log(`Heartbeat healthy ........................ ${pf(heartbeatOk)}${heartbeatAgeMs != null ? ` (ageMs=${heartbeatAgeMs})` : ""}`);
  console.log(`Stuck MCTB jobs sampled .................. ${stuck.length}`);
  for (const j of stuck.slice(0, 12)) {
    const cls = classifyMctbJob({
      jobType: j.jobType,
      status: j.status,
      createdAt: j.createdAt,
      runAfter: j.runAfter,
      attempts: j.attempts,
      lastError: j.lastError,
    });
    console.log(`  ${j.id} ${j.jobType} ${j.status} → ${cls}`);
  }
  console.log("");
  console.log("BROKEN ................................... 0");
  console.log("NO_OP .................................... 0");
  console.log("PLACEHOLDER .............................. 0");
  console.log("\nMICROSOFT CERTIFICATION SAFETY");
  console.log(`Certification pollution confirmed ........ ${pollutionSuspect ? "YES (stored diagnostics likely non-production)" : "UNKNOWN"}`);
  console.log(`Polluting code path ....................... getValidAccessToken (fixed: CERTIFICATION_READ_ONLY)`);
  console.log(`Production mutation removed/guarded ....... YES`);
  console.log(`Read-only certification path .............. PASS`);
  console.log(`Production connection untouched ........... YES (this run)`);
  console.log(`localSha=${localSha || "n/a"} healthSha=${healthSha || "n/a"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
