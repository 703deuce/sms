/**
 * Inventory all voice lines, Telnyx connections, TeXML apps, and agent claims.
 * Read-only. Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inventory-voice-lines.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";
import { isMctbTexmlIngressLocked } from "../src/lib/mctb/sip-ingress/sync";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";

type TelnyxPage<T> = { data?: T[]; meta?: { total_pages?: number; page_number?: number } };

function telephony(settingsJson: unknown): Record<string, unknown> | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const t = (settingsJson as Record<string, unknown>).telephony;
  return t && typeof t === "object" ? (t as Record<string, unknown>) : null;
}

function routingOwner(settingsJson: unknown): string | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const top = (settingsJson as Record<string, unknown>).routingOwner;
  if (typeof top === "string" && top.trim()) return top.trim();
  return typeof telephony(settingsJson)?.routingOwner === "string"
    ? String(telephony(settingsJson)?.routingOwner)
    : null;
}

async function paginateTelnyx<T>(
  path: string,
  query: Record<string, string | number> = {},
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<TelnyxPage<T>>(path, {
      query: { ...query, "page[number]": page, "page[size]": 100 },
    });
    const batch = res.data || [];
    out.push(...batch);
    const totalPages = res.meta?.total_pages ?? 1;
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }
  return out;
}

async function main() {
  const prisma = getPrisma();

  const phones = await prisma.phoneNumber.findMany({
    orderBy: [{ workspaceId: "asc" }, { e164: "asc" }],
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      status: true,
      provider: true,
      type: true,
      friendlyName: true,
      voiceForwardTo: true,
      settingsJson: true,
    },
  });

  const agents = await prisma.voiceAgent.findMany({
    select: {
      id: true,
      workspaceId: true,
      name: true,
      status: true,
      agentType: true,
      phoneNumberId: true,
      telnyxAssistantId: true,
      telnyxConnectionId: true,
      linkedPhoneNumberIds: true,
    },
    orderBy: { name: "asc" },
  });

  const agentPhoneJoins = await prisma.voiceAgentPhoneNumber.findMany({
    select: {
      agentId: true,
      phoneNumberId: true,
      workspaceId: true,
      inboundEnabled: true,
      outboundEnabled: true,
      isDefault: true,
    },
  });

  const phoneById = new Map(phones.map((p) => [p.id, p]));
  const agentById = new Map(agents.map((a) => [a.id, a]));

  const dbLines = phones.map((p) => {
    const tel = telephony(p.settingsJson);
    const caps = readPhoneCapabilities({ settingsJson: p.settingsJson });
    const locked = isMctbTexmlIngressLocked(p.settingsJson);
    const claimedByAgents = agents
      .filter(
        (a) =>
          a.phoneNumberId === p.id ||
          (Array.isArray(a.linkedPhoneNumberIds) && a.linkedPhoneNumberIds.includes(p.id)),
      )
      .map((a) => ({ id: a.id, name: a.name, status: a.status, agentType: a.agentType }));

    const joins = agentPhoneJoins
      .filter((j) => j.phoneNumberId === p.id)
      .map((j) => ({
        agentId: j.agentId,
        agentName: agentById.get(j.agentId)?.name || j.agentId,
        inbound: j.inboundEnabled,
        outbound: j.outboundEnabled,
        isDefault: j.isDefault,
      }));

    return {
      e164: p.e164,
      id: p.id,
      workspaceId: p.workspaceId,
      status: p.status,
      provider: p.provider,
      type: p.type,
      friendlyName: p.friendlyName,
      voiceForwardTo: p.voiceForwardTo,
      routingMode: tel?.routingMode ?? null,
      routingOwner: routingOwner(p.settingsJson),
      mctbTexmlLocked: locked,
      aiAfterHoursEnabled: caps.aiAfterHoursEnabled,
      voicemailEnabled: caps.voicemailEnabled,
      forwardingEnabled: caps.forwardingEnabled,
      claimedByAgents,
      agentPhoneJoins: joins,
    };
  });

  const telnyxNumbers = await paginateTelnyx<Record<string, unknown>>("/phone_numbers");
  const telnyxByE164 = new Map(
    telnyxNumbers.map((n) => [String(n.phone_number || ""), n]),
  );

  const telnyxLines = telnyxNumbers.map((n) => ({
    e164: String(n.phone_number || ""),
    telnyxId: n.id,
    status: n.status,
    connectionId: n.connection_id,
    connectionName: n.connection_name,
    messagingProfileId: n.messaging_profile_id,
    inDb: phones.some((p) => p.e164 === String(n.phone_number || "")),
    dbPhoneId: phones.find((p) => p.e164 === String(n.phone_number || ""))?.id ?? null,
    dbWorkspaceId:
      phones.find((p) => p.e164 === String(n.phone_number || ""))?.workspaceId ?? null,
  }));

  const texmlApps = await paginateTelnyx<Record<string, unknown>>("/texml_applications");
  const fqdnConnections = await paginateTelnyx<Record<string, unknown>>("/fqdn_connections");
  const callControlConnections = await paginateTelnyx<Record<string, unknown>>(
    "/credential_connections",
  ).catch(() => [] as Record<string, unknown>[]);

  const connectionSummary = new Map<string, { name: string; kind: string; numbers: string[] }>();

  for (const line of telnyxLines) {
    const cid = String(line.connectionId || "");
    if (!cid) continue;
    const entry = connectionSummary.get(cid) || {
      name: String(line.connectionName || ""),
      kind: "phone_number_connection",
      numbers: [],
    };
    entry.numbers.push(line.e164);
    connectionSummary.set(cid, entry);
  }

  for (const app of texmlApps) {
    const id = String(app.id || "");
    connectionSummary.set(id, {
      name: String(app.friendly_name || app.application_name || "TeXML app"),
      kind: "texml_application",
      numbers: connectionSummary.get(id)?.numbers || [],
    });
  }

  for (const conn of fqdnConnections) {
    const id = String(conn.id || "");
    connectionSummary.set(id, {
      name: String(conn.connection_name || "FQDN connection"),
      kind: "fqdn_connection",
      numbers: connectionSummary.get(id)?.numbers || [],
    });
  }

  const knownIds: Record<string, string> = {
    [MCTB_TEXML_DEFAULT_APP_ID]: "MCTB TeXML (frozen final pipeline)",
    "3022029259041408870": "LiveKit FQDN inbound (competing — do not use on 866)",
  };

  const connections = [...connectionSummary.entries()]
    .map(([id, v]) => ({
      connectionId: id,
      name: v.name,
      kind: v.kind,
      label: knownIds[id] || null,
      assignedNumbers: v.numbers.sort(),
      numberCount: v.numbers.length,
    }))
    .sort((a, b) => b.numberCount - a.numberCount || a.name.localeCompare(b.name));

  const texmlAppDetails = texmlApps.map((app) => ({
    id: app.id,
    name: app.friendly_name || app.application_name,
    active: app.active,
    voiceUrl: app.voice_url,
    voiceMethod: app.voice_method,
    statusCallback: app.status_callback,
  }));

  const fqdnDetails = fqdnConnections.map((c) => ({
    id: c.id,
    name: c.connection_name,
    active: c.active,
    inbound: c.inbound,
    outbound: c.outbound,
  }));

  const ws1 = dbLines.filter((l) => l.workspaceId === "ws_1");
  const competing866 = dbLines.filter((l) => l.e164.includes("8663464256"));

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          dbPhoneCount: dbLines.length,
          telnyxPhoneCount: telnyxLines.length,
          voiceAgentCount: agents.length,
          texmlAppCount: texmlApps.length,
          fqdnConnectionCount: fqdnConnections.length,
          ws1PhoneCount: ws1.length,
        },
        ws1VoiceLines: ws1,
        e164_866_detail: competing866,
        allDbVoiceLines: dbLines,
        telnyxVoiceLines: telnyxLines.sort((a, b) => a.e164.localeCompare(b.e164)),
        telnyxConnections: connections,
        texmlApplications: texmlAppDetails,
        fqdnConnections: fqdnDetails,
        voiceAgents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          workspaceId: a.workspaceId,
          status: a.status,
          agentType: a.agentType,
          primaryPhone:
            a.phoneNumberId && phoneById.get(a.phoneNumberId)
              ? {
                  id: a.phoneNumberId,
                  e164: phoneById.get(a.phoneNumberId)!.e164,
                }
              : null,
          linkedPhones: (Array.isArray(a.linkedPhoneNumberIds) ? a.linkedPhoneNumberIds : [])
            .map((id) => ({
              id,
              e164: phoneById.get(id)?.e164 ?? null,
            }))
            .filter((x) => x.e164),
          telnyxAssistantId: a.telnyxAssistantId,
          telnyxConnectionId: a.telnyxConnectionId,
        })),
        agentPhoneJoins: agentPhoneJoins.map((j) => ({
          ...j,
          agentName: agentById.get(j.agentId)?.name,
          e164: phoneById.get(j.phoneNumberId)?.e164,
        })),
        orphanTelnyxNumbers: telnyxLines.filter((n) => !n.inDb),
        dbOnlyNumbers: dbLines.filter((p) => !telnyxByE164.has(p.e164)).map((p) => p.e164),
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
