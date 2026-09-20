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
  return { ok: true, trunkId: trunk.sipTrunkId, actions };
}
