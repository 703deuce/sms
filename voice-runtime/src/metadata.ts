export type AmyProcessUserData = {
  callContext?: import("@/lib/voice/domain-actions").LiveKitCallContext;
};

/** @deprecated import from @/lib/telephony/provisioning/metadata */
export {
  parseDispatchAttributes,
  parseRoomMetadata,
  roomMetadataSchema,
  type RoomMetadata,
} from "@/lib/telephony/provisioning/metadata";
