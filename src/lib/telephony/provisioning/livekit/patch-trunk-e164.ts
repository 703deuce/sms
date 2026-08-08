import { ListUpdate } from "@livekit/protocol";
import { liveKitDidLookupVariants } from "./did";
import { getLiveKitSipClient } from "./client";
import { TRANSOVO_LIVEKIT_TRUNK_NAME } from "../config";
import { findInboundTrunkContainingNumber, findInboundTrunkByName } from "./trunk";

/** Force trunk numbers to +E.164 and bare variants (fixes Telnyx SIP 404). */
export async function patchInboundTrunkE164Formats(e164: string): Promise<{
  trunkId: string;
  numbers: string[];
  actions: string[];
}> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const numbers = liveKitDidLookupVariants(e164);

  let trunk =
    (await findInboundTrunkContainingNumber(e164)) ||
    (await findInboundTrunkByName(TRANSOVO_LIVEKIT_TRUNK_NAME));

  if (!trunk?.sipTrunkId) {
    throw new Error("No LiveKit inbound trunk found to patch");
  }

  await client.updateSipInboundTrunkFields(trunk.sipTrunkId, {
    numbers: new ListUpdate({ set: numbers }),
  });
  actions.push(`patched_trunk_numbers_${numbers.join(",")}`);

  const listed = await client.listSipInboundTrunk({ trunkIds: [trunk.sipTrunkId] });
  const updated = listed[0];
  return {
    trunkId: trunk.sipTrunkId,
    numbers: updated?.numbers || numbers,
    actions,
  };
}
