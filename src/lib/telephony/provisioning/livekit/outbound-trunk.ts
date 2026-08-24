import { ListUpdate, SIPTransport } from "@livekit/protocol";
import type { SIPOutboundTrunkInfo } from "livekit-server-sdk";
import { getLiveKitSipClient } from "./client";
import type { MediaBackend } from "@/lib/voice/media-backend/types";
import { getLiveKitBackendConfig } from "@/lib/voice/media-backend/config";

export const TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME =
  process.env.LIVEKIT_OUTBOUND_TRUNK_NAME?.trim() || "transovo-telnyx-outbound";

/** Platform-wide shared Telnyx → LiveKit outbound trunk (not per customer). */
export function resolvePlatformOutboundTrunkIdFromEnv(
  backend: MediaBackend = "livekit_cloud",
): string | null {
  try {
    const cfg = getLiveKitBackendConfig(backend);
    if (cfg.outboundTrunkId) return cfg.outboundTrunkId;
  } catch {
    // fall through to legacy env
  }
  if (backend === "livekit_cloud") {
    return (
      process.env.LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID?.trim() ||
      process.env.LIVEKIT_OUTBOUND_TRUNK_ID?.trim() ||
      process.env.LIVEKIT_SIP_OUTBOUND_TRUNK?.trim() ||
      null
    );
  }
  return null;
}

export function getStoredLiveKitOutboundTrunkId(): string | null {
  return resolvePlatformOutboundTrunkIdFromEnv();
}

export async function findOutboundTrunkByName(
  name: string,
  backend: MediaBackend = "livekit_cloud",
): Promise<SIPOutboundTrunkInfo | null> {
  const client = getLiveKitSipClient(backend);
  const trunks = await client.listSipOutboundTrunk();
  return trunks.find((t) => t.name === name) || null;
}

export async function ensureLiveKitOutboundTrunk(input: {
  callerIdE164: string;
  address?: string;
  authUsername?: string;
  authPassword?: string;
  backend?: MediaBackend;
}): Promise<{ trunk: SIPOutboundTrunkInfo; created: boolean; actions: string[] }> {
  const backend = input.backend || "livekit_cloud";
  const client = getLiveKitSipClient(backend);
  const trunkName = getLiveKitBackendConfig(backend).outboundTrunkName;
  const actions: string[] = [];
  const number = input.callerIdE164.replace(/\s/g, "");

  const storedId = resolvePlatformOutboundTrunkIdFromEnv(backend);
  if (storedId) {
    const listed = await client.listSipOutboundTrunk({ trunkIds: [storedId] });
    if (listed[0]) {
      let trunk = listed[0];
      const numbers = trunk.numbers || [];
      if (!numbers.includes(number)) {
        trunk = await client.updateSipOutboundTrunkFields(trunk.sipTrunkId!, {
          numbers: new ListUpdate({ set: [...new Set([...numbers, number])] }),
        });
        actions.push("added_caller_id_to_env_outbound_trunk");
      }
      return { trunk, created: false, actions: [...actions, "reuse_env_outbound_trunk_id"] };
    }
    actions.push("env_outbound_trunk_id_stale");
  }

  let trunk = await findOutboundTrunkByName(trunkName, backend);
  if (trunk) {
    const numbers = trunk.numbers || [];
    if (!numbers.includes(number)) {
      trunk = await client.updateSipOutboundTrunkFields(trunk.sipTrunkId!, {
        numbers: new ListUpdate({ set: [...new Set([...numbers, number])] }),
      });
      actions.push("added_caller_id_to_outbound_trunk");
    }
    return { trunk, created: false, actions: [...actions, "reuse_named_outbound_trunk"] };
  }

  const address =
    input.address?.trim() ||
    process.env.TELNYX_SIP_OUTBOUND_ADDRESS?.trim() ||
    "sip.telnyx.com";
  const authUsername =
    input.authUsername?.trim() || process.env.TELNYX_SIP_OUTBOUND_USERNAME?.trim() || "";
  const authPassword =
    input.authPassword?.trim() || process.env.TELNYX_SIP_OUTBOUND_PASSWORD?.trim() || "";

  if (!authUsername || !authPassword) {
    throw new Error(
      "Telnyx SIP outbound credentials missing — set TELNYX_SIP_OUTBOUND_USERNAME and TELNYX_SIP_OUTBOUND_PASSWORD",
    );
  }

  trunk = await client.createSipOutboundTrunk(
    trunkName,
    address,
    [number],
    {
      transport: SIPTransport.SIP_TRANSPORT_AUTO,
      authUsername,
      authPassword,
      metadata: JSON.stringify({ owner: "transovo", kind: "telnyx_outbound" }),
    },
  );
  actions.push("created_outbound_trunk");
  return { trunk, created: true, actions };
}

/**
 * Resolve the shared platform outbound trunk id for warm transfer / outbound dial.
 * Ensures the customer DID is registered on the trunk when callerIdE164 is provided.
 */
export async function resolvePlatformOutboundTrunkId(input?: {
  callerIdE164?: string | null;
  backend?: MediaBackend;
}): Promise<string | null> {
  const backend = input?.backend || "livekit_cloud";
  const callerId = input?.callerIdE164?.trim();
  if (callerId) {
    try {
      const { trunk } = await ensureLiveKitOutboundTrunk({
        callerIdE164: callerId,
        backend,
      });
      return trunk.sipTrunkId || null;
    } catch {
      // Fall through to env / list-by-name without blocking bootstrap.
    }
  }

  const fromEnv = resolvePlatformOutboundTrunkIdFromEnv(backend);
  if (fromEnv) return fromEnv;

  const byName = await findOutboundTrunkByName(
    getLiveKitBackendConfig(backend).outboundTrunkName,
    backend,
  );
  return byName?.sipTrunkId || null;
}
