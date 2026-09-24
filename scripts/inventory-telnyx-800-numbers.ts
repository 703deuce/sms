/**
 * Read-only inventory of Telnyx-owned +1800… numbers and production assignment.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inventory-telnyx-800-numbers.ts
 */
import { getPrisma } from "@/lib/db";
import { parseMctbPhoneRole } from "@/lib/messaging/compliance/phone-number-class";
import { listTelnyxOwnedNumbers } from "@/lib/voice/telnyx/number-import";
import { isMctbTexmlIngressConnection } from "@/lib/mctb/texml-ingress/texml-route";
import { workspaceNumberUsesTexmlDirect } from "@/lib/voice/telnyx/texml-direct-route";

function is800TollFree(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") && digits.slice(1, 4) === "800";
}

async function main() {
  const owned = await listTelnyxOwnedNumbers();
  const eightHundreds = owned.filter((n) => is800TollFree(n.e164));
  const prisma = getPrisma();

  const phoneRows = await prisma.phoneNumber.findMany({
    where: { status: "Active", provider: "telnyx" },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });
  const byE164 = new Map(phoneRows.map((r) => [r.e164, r]));

  const mctbIngress = await prisma.missedCallTextConfig.findMany({
    select: { workspaceId: true, phoneNumberId: true },
  });
  const ingressByPhoneId = new Map(mctbIngress.map((c) => [c.phoneNumberId, c.workspaceId]));

  let voiceAssignments: Array<{ phoneNumberId: string; workspaceId: string; agentId: string }> =
    [];
  try {
    voiceAssignments = await prisma.voiceAgentPhoneNumber.findMany({
      select: { phoneNumberId: true, workspaceId: true, agentId: true },
    });
  } catch {
    voiceAssignments = [];
  }
  const voiceByPhoneId = new Map(voiceAssignments.map((v) => [v.phoneNumberId, v]));

  const rows = [];
  for (const n of eightHundreds) {
    const db = byE164.get(n.e164);
    let voiceV3TexmlDirect = false;
    if (db) {
      voiceV3TexmlDirect = await workspaceNumberUsesTexmlDirect({
        workspaceId: db.workspaceId,
        phoneNumberId: db.id,
      });
    }
    const mctbRole = db ? parseMctbPhoneRole(db.settingsJson) : null;
    const mctbIngressWs = db ? ingressByPhoneId.get(db.id) : null;
    const voiceAgent = db ? voiceByPhoneId.get(db.id) : null;
    const onMctbTexml = isMctbTexmlIngressConnection(n.connectionId);

    const blockers: string[] = [];
    if (mctbRole === "platform_mctb_sender") blockers.push("platform_mctb_sender");
    if (db && mctbIngressWs && mctbIngressWs !== "ws_1") {
      blockers.push(`mctb_ingress_for_${mctbIngressWs}`);
    }
    if (voiceAgent) blockers.push(`voice_agent_${voiceAgent.agentId}`);
    if (voiceV3TexmlDirect) blockers.push("voice_v3_texml_direct");
    if (db && db.workspaceId !== "ws_1") {
      blockers.push(`phone_row_in_${db.workspaceId}`);
    }

    rows.push({
      e164: n.e164,
      telnyxProviderNumberId: n.id,
      telnyxStatus: n.status,
      connectionId: n.connectionId,
      onMctbTexmlConnection: onMctbTexml,
      dbPhoneNumberId: db?.id ?? null,
      dbWorkspaceId: db?.workspaceId ?? null,
      mctbRole,
      mctbIngressWorkspaceId: mctbIngressWs ?? null,
      safeForWs1Ingress: blockers.length === 0,
      blockers,
    });
  }

  const safe = rows.filter((r) => r.safeForWs1Ingress);

  console.log(
    JSON.stringify(
      {
        totalTelnyxNumbers: owned.length,
        total800Prefix: eightHundreds.length,
        safeForWs1: safe,
        all800: rows,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
