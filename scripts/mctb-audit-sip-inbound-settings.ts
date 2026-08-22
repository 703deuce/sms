/**
 * Audit SIP inbound late-media settings on Telnyx connections.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-audit-sip-inbound-settings.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-audit-sip-inbound-settings.ts --connection-id 3022029259041408870
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  MCTB_571_CALL_CONTROL_DIAG_APP_ID,
  fetchConnectionLateMediaSettings,
  readInboundLateMediaSettings,
  readThirdPartyControlEnabled,
} from "@/lib/mctb/consent-prompt/telnyx-3pcc";
import { TRANSOVO_LIVEKIT_INBOUND_FQDN_CONNECTION_ID } from "./mctb-setup-livekit-sip-571";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readInboundFlag(
  connection: Record<string, unknown> | null,
  field: string,
): boolean | null {
  if (!connection) return null;
  const top = connection[field];
  if (typeof top === "boolean") return top;
  const inbound = asRecord(connection.inbound);
  const nested = inbound?.[field];
  if (typeof nested === "boolean") return nested;
  return null;
}

async function fetchConnectionRaw(connectionId: string): Promise<{
  path: string;
  data: Record<string, unknown>;
} | null> {
  const probes = [
  `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  `/credential_connections/${encodeURIComponent(connectionId)}`,
  `/call_control_applications/${encodeURIComponent(connectionId)}`,
  `/connections/${encodeURIComponent(connectionId)}`,
  ];
  for (const path of probes) {
    try {
      const res = await telnyxRequest<{ data?: Record<string, unknown> }>(path);
      const data = asRecord(res.data);
      if (data?.id) return { path, data };
    } catch {
      // not this type
    }
  }
  return null;
}

function summarize(connection: Record<string, unknown>, kind: string) {
  const inbound = asRecord(connection.inbound);
  const lateMedia = readInboundLateMediaSettings(connection, kind as never);
  return {
    id: connection.id,
    connection_name: connection.connection_name || connection.application_name,
    ...lateMedia,
    ringback_settings: inbound?.ringback_settings ?? connection.ringback_settings ?? null,
    inbound_keys: inbound ? Object.keys(inbound).sort() : [],
  };
}

async function main() {
  const argIdx = process.argv.indexOf("--connection-id");
  const explicitId = argIdx >= 0 ? process.argv[argIdx + 1] : null;

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": MCTB_PLATFORM_DEMO_E164, "page[size]": 1 },
  });
  const liveConnectionId = String(listed.data?.[0]?.connection_id || "");

  const targets = [
    { label: "571_live_assignment", id: liveConnectionId },
    { label: "call_control_diagnostic", id: MCTB_571_CALL_CONTROL_DIAG_APP_ID },
    { label: "livekit_fqdn_sip", id: TRANSOVO_LIVEKIT_INBOUND_FQDN_CONNECTION_ID },
  ];
  if (explicitId) {
    targets.unshift({ label: "explicit", id: explicitId });
  }

  console.log("\n══ Telnyx SIP inbound settings audit ══\n");
  for (const target of targets) {
    if (!target.id) continue;
    const raw = await fetchConnectionRaw(target.id);
    const lateMedia = await fetchConnectionLateMediaSettings(target.id);
    const isLive = target.id === liveConnectionId;
    console.log(`── ${target.label} (${target.id})${isLive ? " **571 LIVE**" : ""} ──`);
    console.log(`  API path: ${raw?.path || "(not found)"}`);
    console.log(`  Kind: ${lateMedia.kind}`);
    console.log(`  Name: ${lateMedia.connectionName || "(none)"}`);
    console.log(
      `  late-media: 3PCC=${lateMedia.settings.thirdPartyControlEnabled} prack=${lateMedia.settings.prackEnabled} ringback=${lateMedia.settings.generateRingbackTone}`,
    );
    console.log(`  SIP inbound fields supported: ${lateMedia.settings.supportsSipInboundLateMediaFields ? "yes" : "no"}`);
    if (raw?.data) {
      console.log(JSON.stringify(summarize(raw.data, lateMedia.kind), null, 2));
      const interesting = Object.fromEntries(
        Object.entries(raw.data).filter(([k]) =>
          /prack|ringback|third|inbound|sdp|media|codec/i.test(k),
        ),
      );
      if (Object.keys(interesting).length) {
        console.log("  Raw interesting top-level fields:");
        console.log(JSON.stringify(interesting, null, 2));
      }
      const inbound = asRecord(raw.data.inbound);
      if (inbound) {
        const inboundInteresting = Object.fromEntries(
          Object.entries(inbound).filter(([k]) =>
            /prack|ringback|third|sdp|media|codec/i.test(k),
          ),
        );
        if (Object.keys(inboundInteresting).length) {
          console.log("  Raw interesting inbound fields:");
          console.log(JSON.stringify(inboundInteresting, null, 2));
        }
      }
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
