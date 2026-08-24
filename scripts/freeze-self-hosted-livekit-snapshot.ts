#!/usr/bin/env npx tsx
/**
 * Export a no-secrets snapshot of the active self-hosted LiveKit + Telnyx MCTB ingress.
 * Use after a verified production call to freeze rollback state.
 *
 * Usage:
 *   npx tsx scripts/freeze-self-hosted-livekit-snapshot.ts
 *   npx tsx scripts/freeze-self-hosted-livekit-snapshot.ts --write docs/snapshots/self-hosted-livekit-working-latest.json
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import { getPrisma } from "@/lib/db";
import { SipClient } from "livekit-server-sdk";
import {
  getActiveMediaBackend,
  getLiveKitBackendConfig,
  isMediaBackendConfigured,
  resolveAuthoritativeLiveKitSipHost,
} from "@/lib/voice/media-backend";

const writePath = process.argv.find((a) => a.startsWith("--write="))?.slice("--write=".length)
  || (process.argv.includes("--write") ? process.argv[process.argv.indexOf("--write") + 1] : null);
const e164 = process.argv.find((a) => a.startsWith("+")) || MCTB_PLATFORM_DEMO_E164;

function apiUrl(wss: string) {
  return wss.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

function gitCommit(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function livekitSummary(backend: "livekit_cloud" | "self_hosted") {
  if (!isMediaBackendConfigured(backend)) {
    return { configured: false as const };
  }
  const cfg = getLiveKitBackendConfig(backend);
  const client = new SipClient(apiUrl(cfg.url), cfg.apiKey, cfg.apiSecret);
  const trunks = await client.listSipInboundTrunk();
  const rules = await client.listSipDispatchRule();
  const trunk571 = trunks.find((t) => (t.numbers || []).some((n) => n.includes(e164.replace("+", ""))));
  const envTrunk = trunks.find((t) => t.sipTrunkId === cfg.inboundTrunkId);
  const envRule = rules.find((r) => r.sipDispatchRuleId === cfg.dispatchRuleId);
  return {
    configured: true as const,
    url: cfg.url,
    sipHost: cfg.sipHost,
    inboundTrunkId: cfg.inboundTrunkId,
    outboundTrunkId: cfg.outboundTrunkId,
    dispatchRuleId: cfg.dispatchRuleId,
    trunk571: trunk571
      ? {
          id: trunk571.sipTrunkId,
          allowed: (trunk571 as { allowedAddresses?: string[] }).allowedAddresses || [],
          codecsRestricted: Boolean(
            (trunk571 as { media?: { onlyListedCodecs?: boolean } }).media?.onlyListedCodecs,
          ),
        }
      : null,
    envTrunkMatches571: envTrunk?.sipTrunkId === trunk571?.sipTrunkId,
    dispatchAgent: envRule?.roomConfig?.agents?.[0]?.agentName || null,
  };
}

async function telnyxFqdn() {
  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const primary = (fqdns.data || []).find((r) => String(r.id) === primaryId);
  return {
    connectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    primaryFqdnId: primaryId || null,
    primaryFqdn: String(primary?.fqdn || ""),
  };
}

async function phoneRow() {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164 },
    select: { id: true, workspaceId: true, status: true, settingsJson: true },
  });
  if (!pn) return null;
  const settings = (pn.settingsJson || {}) as Record<string, unknown>;
  const telephony = (settings.telephony || settings.provisioning || {}) as Record<string, unknown>;
  return {
    id: pn.id,
    workspaceId: pn.workspaceId,
    status: pn.status,
    mctbSipIngress: settings.mctbSipIngress ?? null,
    routingMode: telephony.routingMode ?? null,
    livekitInboundTrunkId: telephony.livekitInboundTrunkId ?? null,
    livekitDispatchRuleId: telephony.livekitDispatchRuleId ?? null,
  };
}

async function main() {
  const active = getActiveMediaBackend();
  const sip = resolveAuthoritativeLiveKitSipHost();
  const snapshot = {
    capturedAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    e164,
    activeMediaBackend: active,
    authoritativeSipHost: sip.host,
    sipHostSource: sip.source,
    selfHosted: await livekitSummary("self_hosted"),
    cloud: await livekitSummary("livekit_cloud"),
    telnyx: await telnyxFqdn(),
    phoneNumber: await phoneRow(),
    rollback: {
      toCloud: [
        "npx tsx scripts/rollback-telnyx-fqdn-to-cloud.ts --apply",
        "MEDIA_BACKEND_MODE=livekit_cloud",
        "Redeploy transovo-web and transovo-voice",
      ],
    },
  };

  const json = JSON.stringify(snapshot, null, 2);
  console.log(json);

  if (writePath) {
    writeFileSync(writePath, `${json}\n`, "utf8");
    console.error(`\nWrote ${writePath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
