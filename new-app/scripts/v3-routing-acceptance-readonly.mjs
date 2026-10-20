/**
 * V3 routing acceptance — read-only evidence collection.
 * No LiveKit mutations. No deploy.
 *
 *   cd new-app && npx tsx scripts/v3-routing-acceptance-readonly.mjs
 *   npx tsx scripts/v3-routing-acceptance-readonly.mjs --e164 +15714073615
 */
import { SipClient } from "livekit-server-sdk";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const EXPECTED_WORKER = process.env.VOICE_V3_LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-v3";
const CANONICAL_RULE_NAME =
  process.env.LIVEKIT_DISPATCH_RULE_NAME?.trim() || "transovo-inbound-dispatch";
const TRUNK_NAME = process.env.LIVEKIT_INBOUND_TRUNK_NAME?.trim() || "transovo-telnyx-inbound";
const OBSOLETE_PREFIX = "transovo-did-dispatch-";

const e164Arg = process.argv.find((a) => a.startsWith("+")) || process.env.V3_ACCEPTANCE_TEST_E164?.trim();

function redactUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"));
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return "configured";
  }
}

function runUnitLogicTest() {
  const logicPath = join(__dir, "test-canonical-dispatch-logic.mjs");
  if (!existsSync(logicPath)) {
    return { ok: null, skipped: true, reason: "test-canonical-dispatch-logic.mjs not present in this deploy" };
  }
  const r = spawnSync("npx", ["tsx", logicPath], {
    cwd: join(__dir, ".."),
    encoding: "utf8",
  });
  return {
    ok: r.status === 0,
    skipped: false,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim().slice(0, 500),
  };
}

async function auditLiveKit() {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) {
    return { ok: false, skipped: true, reason: "LIVEKIT_URL/API_KEY/API_SECRET not set in this environment" };
  }

  const client = new SipClient(url, apiKey, apiSecret);
  const trunks = await client.listSipInboundTrunk();
  const rules = await client.listSipDispatchRule();

  const canonical = rules.filter((r) => r.name === CANONICAL_RULE_NAME);
  const obsolete = rules.filter((r) => r.name?.startsWith(OBSOLETE_PREFIX));
  const otherV3 = rules.filter(
    (r) =>
      r.name !== CANONICAL_RULE_NAME &&
      !r.name?.startsWith(OBSOLETE_PREFIX) &&
      (r.roomConfig?.agents?.[0]?.agentName === EXPECTED_WORKER ||
        r.name?.includes("transovo")),
  );

  const trunk = trunks.find((t) => t.name === TRUNK_NAME) || trunks[0];

  const canonicalReport = canonical.map((r) => ({
    ruleId: r.sipDispatchRuleId,
    name: r.name,
    ruleType: r.rule?.rule?.case,
    agentName: r.roomConfig?.agents?.[0]?.agentName,
    agentMatchesWorker: r.roomConfig?.agents?.[0]?.agentName === EXPECTED_WORKER,
    trunkIds: r.trunkIds,
    perNumberBindings: r.numbers?.length ? r.numbers.length : 0,
  }));

  const wouldDeleteOnCanonicalApply = [
    ...obsolete.map((r) => ({ ruleId: r.sipDispatchRuleId, name: r.name, reason: "obsolete_per_did_prefix" })),
    ...(canonical.length > 1
      ? canonical.slice(1).map((r) => ({
          ruleId: r.sipDispatchRuleId,
          name: r.name,
          reason: "duplicate_canonical_name",
        }))
      : []),
  ];

  return {
    ok: true,
    skipped: false,
    livekitHost: redactUrl(url),
    expectedWorker: EXPECTED_WORKER,
    trunk: trunk
      ? {
          id: trunk.sipTrunkId,
          name: trunk.name,
          numberCount: trunk.numbers?.length ?? 0,
          sampleNumbers: (trunk.numbers || []).slice(0, 8),
        }
      : null,
    dispatchRuleCount: rules.length,
    canonicalRules: canonicalReport,
    canonicalRuleCount: canonical.length,
    individualRuleOk: canonicalReport.some((r) => r.ruleType === "dispatchRuleIndividual"),
    workerTargetOk: canonicalReport.some((r) => r.agentMatchesWorker),
    obsoletePerDidRules: obsolete.map((r) => ({ ruleId: r.sipDispatchRuleId, name: r.name })),
    otherTransovoRules: otherV3.map((r) => ({
      ruleId: r.sipDispatchRuleId,
      name: r.name,
      agent: r.roomConfig?.agents?.[0]?.agentName,
    })),
    wouldDeleteOnScopedApply: wouldDeleteOnCanonicalApply,
    workerRegistrationNote:
      "LiveKit Cloud worker registration (agent online) is not exposed via SIP API — confirm in LiveKit dashboard or agent logs.",
  };
}

function normalizeE164(phone) {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function auditDatabase(e164) {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, skipped: true, reason: "DATABASE_URL not set" };
  }
  const prisma = new PrismaClient();
  try {
    const unassignedProbe = "+19998887777";
    const phones = e164
      ? await prisma.phoneNumber.findMany({
          where: { e164: normalizeE164(e164) },
          select: { id: true, e164: true, workspaceId: true, status: true, settingsJson: true },
        })
      : await prisma.phoneNumber.findMany({
          where: {
            status: "Active",
            OR: [
              { settingsJson: { path: ["telephony", "routingMode"], equals: "livekit_sip" } },
              { settingsJson: { path: ["telephony", "ingressStrategy"], equals: "shared_voice" } },
            ],
          },
          take: 15,
          select: { id: true, e164: true, workspaceId: true, status: true, settingsJson: true },
        });

    const receptionistInventory = await prisma.voiceAgent.findMany({
      where: { agentType: "appointment_receptionist", archivedAt: null },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        status: true,
        publishedVersionId: true,
        phoneNumberId: true,
      },
      take: 20,
    });
    const receptionistAssignments = await prisma.voiceAgentPhoneNumber.findMany({
      where: { inboundEnabled: true, agent: { agentType: "appointment_receptionist" } },
      include: {
        agent: { select: { name: true, publishedVersionId: true, status: true } },
      },
      take: 20,
    });
    const assignmentPhoneIds = [...new Set(receptionistAssignments.map((a) => a.phoneNumberId))];
    const assignmentPhones = assignmentPhoneIds.length
      ? await prisma.phoneNumber.findMany({
          where: { id: { in: assignmentPhoneIds } },
          select: { id: true, e164: true, status: true },
        })
      : [];
    const phoneById = new Map(assignmentPhones.map((p) => [p.id, p]));
    const receptionistInboundAssignments = receptionistAssignments.map((a) => ({
      ...a,
      phone: phoneById.get(a.phoneNumberId) || null,
    }));

    const phoneReports = [];
    for (const p of phones) {
      const telephony = p.settingsJson?.telephony || {};
      const agents = await prisma.voiceAgent.findMany({
        where: { workspaceId: p.workspaceId, agentType: "RECEPTIONIST", archivedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          publishedVersionId: true,
          phoneNumberId: true,
          emergencyDisabled: true,
        },
      });
      const assign = await prisma.voiceAgentPhoneNumber.findMany({
        where: { phoneNumberId: p.id, inboundEnabled: true },
        include: {
          agent: {
            select: { id: true, name: true, status: true, publishedVersionId: true, agentType: true },
          },
        },
      });
      phoneReports.push({
        phoneId: p.id,
        e164: p.e164,
        workspaceId: p.workspaceId,
        status: p.status,
        routingMode: telephony.routingMode,
        ingressStrategy: telephony.ingressStrategy,
        livekitInboundTrunkId: telephony.livekitInboundTrunkId || telephony.provision?.livekitInboundTrunkId,
        telnyxConnectionId: telephony.telnyxConnectionId,
        receptionistAgents: agents,
        inboundAssignments: assign,
        publishedReady: agents.some((a) => a.publishedVersionId && (a.phoneNumberId === p.id || assign.some((x) => x.agentId === a.id))),
      });
    }

    const unassignedPhone = await prisma.phoneNumber.findFirst({
      where: { e164: unassignedProbe, status: "Active" },
    });
    const fakeResolveWouldFindPhone = Boolean(unassignedPhone);

    return {
      ok: true,
      skipped: false,
      e164Queried: e164 ? normalizeE164(e164) : null,
      receptionistInventory,
      receptionistInboundAssignments,
      phoneCount: phoneReports.length,
      phones: phoneReports,
      unassignedProbeE164: unassignedProbe,
      unassignedProbeHasActivePhoneRow: fakeResolveWouldFindPhone,
      routingResolveNote:
        "Production resolve returns null when no receptionist assignment; no cross-workspace default in routing-resolve.ts.",
    };
  } finally {
    await prisma.$disconnect();
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: "read_only",
  unitLogic: runUnitLogicTest(),
  livekit: await auditLiveKit(),
  database: await auditDatabase(e164Arg),
};

console.log(JSON.stringify(report, null, 2));
