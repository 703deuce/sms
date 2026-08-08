import { ListUpdate } from "@livekit/protocol";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { SIPInboundTrunkInfo } from "livekit-server-sdk";
import {
  getStoredLiveKitTrunkId,
  TRANSOVO_LIVEKIT_TRUNK_NAME,
} from "../config";
import {
  liveKitDidLookupVariants,
  toLiveKitInboundDid,
  trunkNumbersIncludeDid,
} from "./did";
import { getLiveKitSipClient } from "./client";

async function assertTrunkHasNumber(
  trunkId: string,
  e164: string,
): Promise<SIPInboundTrunkInfo> {
  const client = getLiveKitSipClient();
  const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
  const trunk = listed[0];
  if (!trunk) throw new Error(`LiveKit inbound trunk ${trunkId} not found after update`);
  const did = toLiveKitInboundDid(e164);
  if (!trunkNumbersIncludeDid(trunk.numbers || [], e164)) {
    throw new Error(
      `LiveKit inbound trunk ${trunkId} missing ${did} after update (numbers=${(trunk.numbers || []).join(",") || "none"})`,
    );
  }
  return trunk;
}

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
  const trunks = await client.listSipInboundTrunk({
    numbers: liveKitDidLookupVariants(e164),
  });
  return trunks.find((t) => trunkNumbersIncludeDid(t.numbers || [], e164)) || null;
}

export async function ensureSharedInboundTrunk(input?: {
  initialNumbers?: string[];
  e164?: string;
}): Promise<{ trunk: SIPInboundTrunkInfo; created: boolean; actions: string[] }> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const seedNumbers = input?.initialNumbers?.length
    ? input.initialNumbers
    : input?.e164
      ? [input.e164]
      : [];

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

  if (!seedNumbers.length) {
    throw new Error(
      "Cannot create LiveKit inbound trunk without at least one phone number",
    );
  }

  trunk = await client.createSipInboundTrunk(TRANSOVO_LIVEKIT_TRUNK_NAME, seedNumbers, {
    metadata: JSON.stringify({ owner: "transovo", kind: "shared_telnyx_inbound" }),
  });
  actions.push("created_inbound_trunk");
  return { trunk, created: true, actions };
}

/**
 * Ensure one canonical Transovo inbound trunk owns the DID.
 * SaaS repair: delete stale inbound trunks instead of leaving invalid empty trunks behind.
 */
export async function ensureInboundTrunkForNumber(e164: string): Promise<{
  trunk: SIPInboundTrunkInfo;
  created: boolean;
  actions: string[];
}> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const trunkDid = toLiveKitInboundDid(e164);

  const allTrunks = await client.listSipInboundTrunk();
  // Prefer a trunk that already owns the DID — a named empty trunk must not win over it.
  let keeper =
    allTrunks.find((t) => trunkNumbersIncludeDid(t.numbers || [], e164)) ||
    allTrunks.find((t) => t.name === TRANSOVO_LIVEKIT_TRUNK_NAME) ||
    (getStoredLiveKitTrunkId()
      ? allTrunks.find((t) => t.sipTrunkId === getStoredLiveKitTrunkId())
      : null) ||
    null;

  for (const trunk of allTrunks) {
    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId) continue;
    if (keeper?.sipTrunkId && trunkId === keeper.sipTrunkId) continue;
    await client.deleteSipTrunk(trunkId);
    actions.push(`livekit_deleted_stale_trunk_${trunk.name || trunkId}`);
    if (keeper?.sipTrunkId === trunkId) keeper = null;
  }

  if (keeper?.sipTrunkId) {
    const listed = await client.listSipInboundTrunk({ trunkIds: [keeper.sipTrunkId] });
    keeper = listed[0] || null;
    const numbers = keeper?.numbers || [];
    const allowed =
      (keeper as { allowedAddresses?: string[] }).allowedAddresses ||
      (keeper as { allowed_addresses?: string[] }).allowed_addresses ||
      [];
    const hasAuth = Boolean((keeper as { authUsername?: string }).authUsername);
    if (keeper && numbers.length === 0 && allowed.length === 0 && !hasAuth) {
      await client.deleteSipTrunk(keeper.sipTrunkId);
      actions.push("livekit_deleted_invalid_empty_trunk");
      keeper = null;
    }
  }

  if (!keeper) {
    const created = await ensureSharedInboundTrunk({ e164: trunkDid });
    actions.push(...created.actions);
    return created;
  }

  const trunkId = keeper.sipTrunkId || "";
  if (!trunkId) throw new Error("LiveKit inbound trunk id missing");

  const currentNumbers = keeper.numbers || [];
  const hasPlusVariant = currentNumbers.includes(normalizeE164(e164));
  const hasBareVariant = currentNumbers.includes(trunkDid);

  if (!hasBareVariant || hasPlusVariant) {
    const nextNumbers = [
      ...currentNumbers.filter((n) => !liveKitDidLookupVariants(e164).includes(n)),
      trunkDid,
    ];
    await client.updateSipInboundTrunkFields(trunkId, {
      numbers: new ListUpdate({ set: nextNumbers }),
    });
    keeper = await assertTrunkHasNumber(trunkId, e164);
    actions.push(
      hasPlusVariant ? "livekit_trunk_normalized_did_format" : "livekit_trunk_added_number",
    );
  } else {
    keeper = await assertTrunkHasNumber(trunkId, e164);
    actions.push("livekit_trunk_number_ok");
  }

  return { trunk: keeper, created: false, actions };
}

/**
 * Nuclear repair: delete every inbound trunk and recreate the canonical trunk with the DID.
 * Use when LiveKit API reports the number but PSTN still receives SIP 404.
 */
export async function rebuildInboundTrunkForNumber(e164: string): Promise<{
  trunk: SIPInboundTrunkInfo;
  actions: string[];
}> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const allTrunks = await client.listSipInboundTrunk();

  for (const trunk of allTrunks) {
    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId) continue;
    await client.deleteSipTrunk(trunkId);
    actions.push(`livekit_deleted_trunk_${trunk.name || trunkId}`);
  }

  const trunkDid = toLiveKitInboundDid(e164);
  const created = await client.createSipInboundTrunk(TRANSOVO_LIVEKIT_TRUNK_NAME, [trunkDid], {
    metadata: JSON.stringify({ owner: "transovo", kind: "shared_telnyx_inbound" }),
  });
  actions.push("livekit_rebuilt_inbound_trunk");
  const trunkId = created.sipTrunkId || "";
  if (!trunkId) throw new Error("LiveKit inbound trunk id missing after rebuild");
  const trunk = await assertTrunkHasNumber(trunkId, e164);
  return { trunk, actions };
}

export async function addNumberToInboundTrunk(
  trunkId: string,
  e164: string,
): Promise<{ trunk: import("livekit-server-sdk").SIPInboundTrunkInfo; added: boolean }> {
  const client = getLiveKitSipClient();
  const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
  const trunk = listed[0];
  if (!trunk) throw new Error(`LiveKit inbound trunk ${trunkId} not found`);

  const trunkDid = toLiveKitInboundDid(e164);
  const numbers = (trunk.numbers || []).filter(
    (n) => !liveKitDidLookupVariants(e164).includes(n),
  );
  if (trunkNumbersIncludeDid(trunk.numbers || [], e164) && numbers.includes(trunkDid)) {
    return { trunk, added: false };
  }

  const updated = await client.updateSipInboundTrunkFields(trunkId, {
    numbers: new ListUpdate({ set: [...numbers, trunkDid] }),
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

  if (numbers.length === 0) {
    await client.deleteSipTrunk(trunkId);
    return { trunk, removed: true };
  }

  const updated = await client.updateSipInboundTrunkFields(trunkId, {
    numbers: new ListUpdate({ set: numbers }),
  });
  return { trunk: updated, removed: true };
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

    const currentNumbers = trunk.numbers || [];
    const nextNumbers = currentNumbers.filter((n) => n !== e164);
    if (nextNumbers.length === currentNumbers.length) continue;

    // LiveKit rejects trunks with zero numbers — delete stale single-DID trunks outright.
    if (nextNumbers.length === 0) {
      await client.deleteSipTrunk(trunkId);
      actions.push(`livekit_deleted_trunk_${trunk.name || trunkId}`);
      continue;
    }

    await client.updateSipInboundTrunkFields(trunkId, {
      numbers: new ListUpdate({ set: nextNumbers }),
    });
    actions.push(`livekit_removed_number_from_${trunk.name || trunkId}`);
  }

  return { actions };
}
