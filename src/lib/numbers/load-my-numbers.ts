/**
 * My Numbers — routing control center.
 * Assembles Transovo DIDs + customer external numbers + agent deployments.
 */

import { getPrisma } from "@/lib/db";
import {
  deploymentStatusLabel,
  listDeploymentsForWorkspace,
  scheduleLabel,
  type DeploymentSummary,
} from "@/lib/agents/deployments";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";

export type NumberReadiness = {
  voiceReady: boolean;
  messagingReady: boolean;
  voiceLabel: string;
  messagingLabel: string;
};

export type NumberAgentLink = {
  deploymentId: string;
  channel: "voice" | "sms";
  agentName: string;
  agentTypeLabel: string;
  scheduleLabel: string;
  status: string;
  statusLabel: string;
  href: string;
};

export type MyNumberCard = {
  id: string;
  kind: "transovo" | "external";
  e164: string;
  displayName: string;
  status: string;
  ownershipLabel: string;
  /** For external: destination DID. For transovo: who forwards here. */
  relatedE164: string | null;
  relatedLabel: string | null;
  forwardingStatus: string | null;
  readiness: NumberReadiness;
  voiceAgents: NumberAgentLink[];
  smsAgents: NumberAgentLink[];
  href: string;
  note: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function readVoiceReady(settingsJson: unknown, capabilitiesJson: unknown): boolean {
  const caps = asRecord(capabilitiesJson);
  if (caps && caps.voice === false) return false;
  const settings = asRecord(settingsJson);
  const prov = asRecord(settings?.provisioning);
  if (!prov) return Boolean(caps?.voice !== false);
  return (
    prov.state === "fully_configured" ||
    prov.state === "voice_configured" ||
    Boolean(prov.voiceInboundConfigured) ||
    Boolean(prov.connectionId)
  );
}

function toAgentLink(d: DeploymentSummary): NumberAgentLink {
  return {
    deploymentId: d.id,
    channel: d.channel,
    agentName: d.agentName || d.agentTypeLabel || "Agent",
    agentTypeLabel: d.agentTypeLabel || "Agent",
    scheduleLabel: d.scheduleLabel || scheduleLabel(d.scheduleKey),
    status: d.status,
    statusLabel: deploymentStatusLabel(d.status),
    href: d.href,
  };
}

export async function loadMyNumbers(
  workspaceId: string,
): Promise<{
  cards: MyNumberCard[];
  summary: {
    total: number;
    live: number;
    needsAttention: number;
    messagingReadyCount: number;
  };
}> {
  const prisma = getPrisma();
  const [phones, externals, deployments, registration] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { workspaceId, releasedAt: null },
      orderBy: { purchasedAt: "desc" },
      take: 100,
    }),
    prisma.externalNumber.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        forwardingDestination: {
          select: { id: true, e164: true, friendlyName: true },
        },
      },
    }).catch(() => []),
    listDeploymentsForWorkspace(workspaceId).catch(() => [] as DeploymentSummary[]),
    getRegistrationByWorkspace(workspaceId).catch(() => null),
  ]);

  const messagingWorkspaceReady = isMessagingReady(registration);
  const byPhone = new Map<string, DeploymentSummary[]>();
  for (const d of deployments) {
    if (!d.phoneNumberId) continue;
    const list = byPhone.get(d.phoneNumberId) || [];
    list.push(d);
    byPhone.set(d.phoneNumberId, list);
  }

  const cards: MyNumberCard[] = [];

  for (const phone of phones) {
    const deps = byPhone.get(phone.id) || [];
    const voiceAgents = deps.filter((d) => d.channel === "voice").map(toAgentLink);
    const smsAgents = deps.filter((d) => d.channel === "sms").map(toAgentLink);
    const voiceReady = readVoiceReady(phone.settingsJson, phone.capabilitiesJson);
    const messagingReady =
      messagingWorkspaceReady &&
      String(phone.a2pStatus).toUpperCase() !== "REJECTED" &&
      phone.status === "Active";

    const forwarders = (externals as Array<{
      e164: string;
      displayName: string | null;
      forwardingDestinationId: string | null;
      forwardingStatus: string;
    }>).filter((e) => e.forwardingDestinationId === phone.id);

    const live =
      deps.some((d) => d.status === "live") ||
      (voiceAgents.length > 0 && phone.status === "Active");

    cards.push({
      id: phone.id,
      kind: "transovo",
      e164: phone.e164,
      displayName:
        phone.friendlyName?.trim() ||
        (phone.ownershipType === "ported" ? "Ported number" : "Transovo number"),
      status: live ? "Live" : phone.status === "Active" ? "Ready" : phone.status,
      ownershipLabel:
        phone.ownershipType === "ported"
          ? "Ported into Transovo"
          : "Transovo-provided number",
      relatedE164: forwarders[0]?.e164 || null,
      relatedLabel: forwarders[0]
        ? `Receives forwards from ${forwarders[0].displayName || forwarders[0].e164}`
        : null,
      forwardingStatus: forwarders[0]?.forwardingStatus || null,
      readiness: {
        voiceReady,
        messagingReady,
        voiceLabel: voiceReady ? "Voice ready" : "Voice not ready",
        messagingLabel: messagingReady
          ? "SMS ready"
          : "SMS not verified / not messaging-ready",
      },
      voiceAgents,
      smsAgents,
      href: `/numbers/${phone.id}`,
      note: messagingReady
        ? null
        : "Call forwarding moves voice only — SMS stays on this messaging-ready Transovo number once A2P is approved.",
    });
  }

  for (const ext of externals as Array<{
    id: string;
    e164: string;
    displayName: string | null;
    forwardingStatus: string;
    forwardingMode: string;
    forwardingDestination: { id: string; e164: string; friendlyName: string | null } | null;
  }>) {
    const dest = ext.forwardingDestination;
    const destDeps = dest ? byPhone.get(dest.id) || [] : [];
    cards.push({
      id: ext.id,
      kind: "external",
      e164: ext.e164,
      displayName: ext.displayName?.trim() || "Main business line",
      status:
        ext.forwardingStatus === "active"
          ? "Live"
          : ext.forwardingStatus === "unconfirmed" ||
              ext.forwardingStatus === "pending"
            ? "Needs attention"
            : "Not connected",
      ownershipLabel: "Customer-owned number",
      relatedE164: dest?.e164 || null,
      relatedLabel: dest
        ? `Forwards voice to ${dest.friendlyName || dest.e164}`
        : "No Transovo destination set",
      forwardingStatus: ext.forwardingStatus,
      readiness: {
        voiceReady: ext.forwardingStatus === "active" && Boolean(dest),
        messagingReady: false,
        voiceLabel:
          ext.forwardingStatus === "active"
            ? "Voice forwarding active"
            : "Forwarding not confirmed",
        messagingLabel:
          "SMS does not follow call forwarding — use a Transovo messaging number",
      },
      voiceAgents: destDeps
        .filter((d) => d.channel === "voice")
        .map(toAgentLink),
      smsAgents: [],
      href: `/my-numbers?external=${encodeURIComponent(ext.id)}`,
      note: "Ordinary call forwarding does not forward SMS. Texts must use a messaging-ready Transovo number (or porting / hosted messaging).",
    });
  }

  const live = cards.filter((c) => c.status === "Live").length;
  const needsAttention = cards.filter(
    (c) =>
      c.status === "Needs attention" ||
      (!c.readiness.voiceReady && c.kind === "transovo") ||
      (c.kind === "external" && c.forwardingStatus !== "active"),
  ).length;

  return {
    cards,
    summary: {
      total: cards.length,
      live,
      needsAttention,
      messagingReadyCount: cards.filter((c) => c.readiness.messagingReady).length,
    },
  };
}
