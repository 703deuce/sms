import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import type { FrontDeskUserData } from "./frontdesk/userdata";
import type { OutboundLeadUserData } from "./outbound/userdata";

export type AmyUserData = {
  callContext: LiveKitCallContext;
};

export type VoiceRuntimeUserData = AmyUserData | FrontDeskUserData;

export type AnyRuntimeUserData = VoiceRuntimeUserData | OutboundLeadUserData;

export function isAmyUserData(value: VoiceRuntimeUserData): value is AmyUserData {
  return "callContext" in value;
}

/** @deprecated use AmyUserData */
export type AmyProcessUserData = AmyUserData;

/** @deprecated import from @/lib/telephony/provisioning/metadata */
export {
  parseDispatchAttributes,
  parseRoomMetadata,
  roomMetadataSchema,
  type RoomMetadata,
} from "@/lib/telephony/provisioning/metadata";
