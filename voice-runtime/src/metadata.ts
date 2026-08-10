import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import type { FrontDeskUserData } from "./frontdesk/userdata";

export type AmyUserData = {
  callContext: LiveKitCallContext;
};

export type VoiceRuntimeUserData = AmyUserData | FrontDeskUserData;

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
