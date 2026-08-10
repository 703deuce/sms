import type { LiveKitCallContext } from "@/lib/voice/domain-actions";

export type AmyUserData = {
  callContext: LiveKitCallContext;
};

/** @deprecated use AmyUserData */
export type AmyProcessUserData = AmyUserData;

/** @deprecated import from @/lib/telephony/provisioning/metadata */
export {
  parseDispatchAttributes,
  parseRoomMetadata,
  roomMetadataSchema,
  type RoomMetadata,
} from "@/lib/telephony/provisioning/metadata";
