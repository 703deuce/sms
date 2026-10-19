import "server-only";

import { ListUpdate } from "@livekit/protocol";
import type { SIPInboundTrunkInfo } from "livekit-server-sdk";
import { getLiveKitSipClient } from "@/lib/server/receptionist/livekit/client";
import {
  getStoredLiveKitTrunkId,
  TRANSOVO_LIVEKIT_TRUNK_NAME,
} from "@/lib/server/telephony/config";

function normalizeE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (e164.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function toLiveKitInboundDid(e164: string): string {
  const n = normalizeE164(e164);
  return n.startsWith("+") ? n : `+${n.replace(/\D/g, "")}`;
}

function trunkHasDid(numbers: string[], e164: string): boolean {
  const variants = [toLiveKitInboundDid(e164), normalizeE164(e164), e164.replace(/\D/g, "")];
  return variants.some((v) => numbers.includes(v));
}

export async function ensureInboundTrunkForNumber(e164: string): Promise<{
  trunk: SIPInboundTrunkInfo;
  actions: string[];
}> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const allTrunks = await client.listSipInboundTrunk();

  let keeper =
    allTrunks.find((t) => trunkHasDid(t.numbers || [], e164)) ||
    allTrunks.find((t) => t.name === TRANSOVO_LIVEKIT_TRUNK_NAME) ||
    (getStoredLiveKitTrunkId()
      ? allTrunks.find((t) => t.sipTrunkId === getStoredLiveKitTrunkId())
      : null) ||
    null;

  if (!keeper) {
    const did = toLiveKitInboundDid(e164);
    const created = await client.createSipInboundTrunk(TRANSOVO_LIVEKIT_TRUNK_NAME, [did], {
      metadata: JSON.stringify({ owner: "transovo", kind: "shared_telnyx_inbound" }),
    });
    actions.push("livekit_created_inbound_trunk");
    if (!created.sipTrunkId) throw new Error("LiveKit inbound trunk id missing after create");
    return { trunk: created, actions };
  }

  const trunkId = keeper.sipTrunkId || "";
  if (!trunkId) throw new Error("LiveKit inbound trunk id missing");

  if (!trunkHasDid(keeper.numbers || [], e164)) {
    const did = toLiveKitInboundDid(e164);
    const current = keeper.numbers || [];
    await client.updateSipInboundTrunkFields(trunkId, {
      numbers: new ListUpdate({ set: [...current, did] }),
    });
    actions.push("livekit_added_did_to_trunk");
    const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
    keeper = listed[0] || keeper;
  } else {
    actions.push("livekit_trunk_already_has_did");
  }

  return { trunk: keeper, actions };
}
