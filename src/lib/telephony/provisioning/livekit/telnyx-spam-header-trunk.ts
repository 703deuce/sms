import type { SIPInboundTrunkInfo } from "livekit-server-sdk";
import {
  LIVEKIT_SPAM_SCREENING_ATTR,
  TELNYX_CALL_SCREENING_HEADER,
} from "@/lib/voice-v3/spam-protection/types";
import { getLiveKitSipClient } from "./client";
import { findInboundTrunkContainingNumber } from "./trunk";

/**
 * Merge Telnyx spam screening SIP header mapping into the inbound trunk serving this DID.
 * Preserves all other trunk fields (replace update with merged object).
 */
export async function ensureTelnyxSpamHeaderMappingOnInboundTrunk(
  e164: string,
): Promise<{ ok: boolean; trunkId?: string; actions: string[] }> {
  const actions: string[] = [];
  const trunk = await findInboundTrunkContainingNumber(e164);
  if (!trunk?.sipTrunkId) {
    return { ok: false, actions: ["no_inbound_trunk_for_did"] };
  }

  const prev = { ...(trunk.headersToAttributes || {}) };
  const headerKey = TELNYX_CALL_SCREENING_HEADER;
  if (prev[headerKey] === LIVEKIT_SPAM_SCREENING_ATTR) {
    return { ok: true, trunkId: trunk.sipTrunkId, actions: ["spam_header_mapping_present"] };
  }

  const merged: SIPInboundTrunkInfo = {
    ...trunk,
    headersToAttributes: {
      ...prev,
      [headerKey]: LIVEKIT_SPAM_SCREENING_ATTR,
    },
  };

  const client = getLiveKitSipClient();
  await client.updateSipInboundTrunk(trunk.sipTrunkId, merged);
  actions.push("merged_telnyx_spam_header_mapping");

  const listed = await client.listSipInboundTrunk({ trunkIds: [trunk.sipTrunkId] });
  const readBack = listed[0];
  const readHeaders = readBack?.headersToAttributes || {};
  if (readHeaders[headerKey] !== LIVEKIT_SPAM_SCREENING_ATTR) {
    return {
      ok: false,
      trunkId: trunk.sipTrunkId,
      actions: [...actions, "read_back_verification_failed"],
    };
  }
  actions.push("read_back_verified");
  return { ok: true, trunkId: trunk.sipTrunkId, actions };
}

/**
 * Reconcile every managed inbound trunk (preserve settings, merge spam header only).
 */
export async function reconcileAllManagedInboundTrunksSpamHeaderMapping(): Promise<{
  ok: boolean;
  updated: number;
  skipped: number;
  actions: string[];
}> {
  const client = getLiveKitSipClient();
  const trunks = await client.listSipInboundTrunk();
  const actions: string[] = [];
  let updated = 0;
  let skipped = 0;
  const headerKey = TELNYX_CALL_SCREENING_HEADER;

  for (const trunk of trunks) {
    const trunkId = trunk.sipTrunkId;
    if (!trunkId) continue;
    const prev = { ...(trunk.headersToAttributes || {}) };
    if (prev[headerKey] === LIVEKIT_SPAM_SCREENING_ATTR) {
      skipped += 1;
      continue;
    }
    const merged: SIPInboundTrunkInfo = {
      ...trunk,
      headersToAttributes: {
        ...prev,
        [headerKey]: LIVEKIT_SPAM_SCREENING_ATTR,
      },
    };
    await client.updateSipInboundTrunk(trunkId, merged);
    const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
    const readBack = listed[0]?.headersToAttributes || {};
    if (readBack[headerKey] !== LIVEKIT_SPAM_SCREENING_ATTR) {
      actions.push(`verify_failed:${trunkId}`);
      return { ok: false, updated, skipped, actions };
    }
    updated += 1;
    actions.push(`merged:${trunkId}`);
  }

  return { ok: true, updated, skipped, actions };
}
