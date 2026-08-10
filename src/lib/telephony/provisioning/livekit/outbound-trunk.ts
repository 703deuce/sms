import { ListUpdate, SIPTransport } from "@livekit/protocol";
import type { SIPOutboundTrunkInfo } from "livekit-server-sdk";
import { getLiveKitSipClient } from "./client";

export const TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME =
  process.env.LIVEKIT_OUTBOUND_TRUNK_NAME?.trim() || "transovo-telnyx-outbound";

export function getStoredLiveKitOutboundTrunkId(): string | null {
  return process.env.LIVEKIT_OUTBOUND_TRUNK_ID?.trim() || null;
}

export async function findOutboundTrunkByName(
  name: string,
): Promise<SIPOutboundTrunkInfo | null> {
  const client = getLiveKitSipClient();
  const trunks = await client.listSipOutboundTrunk();
  return trunks.find((t) => t.name === name) || null;
}

export async function ensureLiveKitOutboundTrunk(input: {
  callerIdE164: string;
  address?: string;
  authUsername?: string;
  authPassword?: string;
}): Promise<{ trunk: SIPOutboundTrunkInfo; created: boolean; actions: string[] }> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const number = input.callerIdE164.replace(/\s/g, "");

  const storedId = getStoredLiveKitOutboundTrunkId();
  if (storedId) {
    const listed = await client.listSipOutboundTrunk({ trunkIds: [storedId] });
    if (listed[0]) {
      return { trunk: listed[0], created: false, actions: ["reuse_env_outbound_trunk_id"] };
    }
    actions.push("env_outbound_trunk_id_stale");
  }

  let trunk = await findOutboundTrunkByName(TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME);
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
    TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME,
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
