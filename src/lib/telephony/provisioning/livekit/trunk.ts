import { ListUpdate } from "@livekit/protocol";
import type { SIPInboundTrunkInfo } from "livekit-server-sdk";
import {
  getStoredLiveKitTrunkId,
  TRANSOVO_LIVEKIT_TRUNK_NAME,
} from "../config";
import { getLiveKitSipClient } from "./client";

export async function findInboundTrunkByName(
  name: string,
): Promise<SIPInboundTrunkInfo | null> {
  const client = getLiveKitSipClient();
  const trunks = await client.listSipInboundTrunk();
  return trunks.find((t) => t.name === name) || null;
}

export async function findInboundTrunkContainingNumber(
  e164: string,
): Promise<SIPInboundTrunkInfo | null> {
  const client = getLiveKitSipClient();
  const trunks = await client.listSipInboundTrunk({ numbers: [e164] });
  return trunks.find((t) => (t.numbers || []).includes(e164)) || null;
}

export async function ensureSharedInboundTrunk(input?: {
  initialNumbers?: string[];
}): Promise<{ trunk: SIPInboundTrunkInfo; created: boolean; actions: string[] }> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];

  const storedId = getStoredLiveKitTrunkId();
  if (storedId) {
    const listed = await client.listSipInboundTrunk({ trunkIds: [storedId] });
    if (listed[0]) {
      return { trunk: listed[0], created: false, actions: ["reuse_env_trunk_id"] };
    }
    actions.push("env_trunk_id_stale");
  }

  let trunk = await findInboundTrunkByName(TRANSOVO_LIVEKIT_TRUNK_NAME);
  if (trunk) {
    return { trunk, created: false, actions: ["reuse_named_trunk"] };
  }

  trunk = await client.createSipInboundTrunk(TRANSOVO_LIVEKIT_TRUNK_NAME, [], {
    metadata: JSON.stringify({ owner: "transovo", kind: "shared_telnyx_inbound" }),
  });
  actions.push("created_inbound_trunk");
  return { trunk, created: true, actions };
}

export async function addNumberToInboundTrunk(
  trunkId: string,
  e164: string,
): Promise<{ trunk: import("livekit-server-sdk").SIPInboundTrunkInfo; added: boolean }> {
  const client = getLiveKitSipClient();
  const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
  const trunk = listed[0];
  if (!trunk) throw new Error(`LiveKit inbound trunk ${trunkId} not found`);

  const numbers = trunk.numbers || [];
  if (numbers.includes(e164)) {
    return { trunk, added: false };
  }

  const updated = await client.updateSipInboundTrunkFields(trunkId, {
    numbers: new ListUpdate({ set: [...numbers, e164] }),
  });
  return { trunk: updated, added: true };
}

export async function removeNumberFromInboundTrunk(
  trunkId: string,
  e164: string,
): Promise<{ trunk: import("livekit-server-sdk").SIPInboundTrunkInfo; removed: boolean }> {
  const client = getLiveKitSipClient();
  const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
  const trunk = listed[0];
  if (!trunk) throw new Error(`LiveKit inbound trunk ${trunkId} not found`);

  const numbers = (trunk.numbers || []).filter((n) => n !== e164);
  if (numbers.length === (trunk.numbers || []).length) {
    return { trunk, removed: false };
  }

  const updated = await client.updateSipInboundTrunkFields(trunkId, {
    numbers: new ListUpdate({ set: numbers }),
  });
  return { trunk: updated, removed: true };
}

function isTransovoInboundTrunk(trunk: SIPInboundTrunkInfo): boolean {
  if ((trunk.name || "").includes("transovo")) return true;
  try {
    const meta = trunk.metadata ? JSON.parse(trunk.metadata) : {};
    return meta?.owner === "transovo";
  } catch {
    return false;
  }
}

/**
 * LiveKit rejects duplicate numbers across inbound trunks. Remove the DID from
 * every trunk except the canonical shared Transovo trunk before adding it there.
 */
export async function dedupeInboundTrunkNumber(
  e164: string,
  keepTrunkId: string,
): Promise<{ actions: string[] }> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const trunks = await client.listSipInboundTrunk({ numbers: [e164] });

  for (const trunk of trunks) {
    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId || trunkId === keepTrunkId) continue;

    const removed = await removeNumberFromInboundTrunk(trunkId, e164);
    if (removed.removed) {
      actions.push(`livekit_removed_number_from_${trunk.name || trunkId}`);
    }

    const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
    const remaining = listed[0]?.numbers || [];
    if (remaining.length === 0 && !isTransovoInboundTrunk(trunk)) {
      await client.deleteSipTrunk(trunkId);
      actions.push(`livekit_deleted_empty_trunk_${trunk.name || trunkId}`);
    }
  }

  return { actions };
}
