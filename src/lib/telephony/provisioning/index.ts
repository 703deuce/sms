export type {
  AgentRoutingResolution,
  AssignNumberToAgentInput,
  AssignNumberToAgentResult,
  EnsureNumberProvisionedInput,
  EnsureNumberProvisionedResult,
  ProvisionState,
  TelephonyProvisionRecord,
  VerifyRoutingResult,
  VoiceRoutingMode,
} from "./types";

export {
  TRANSOVO_LIVEKIT_AGENT_NAME,
  TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
  TRANSOVO_LIVEKIT_ROOM_PREFIX,
  TRANSOVO_LIVEKIT_TRUNK_NAME,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
  assertLiveKitProvisioningEnv,
  getLiveKitSipHost,
  getLiveKitSipHostSource,
  resolveLiveKitSipHost,
} from "./config";

export {
  parseDispatchAttributes,
  parseRoomMetadata,
  roomMetadataSchema,
  type RoomMetadata,
} from "./metadata";

export {
  assignNumberToAgent,
  ensureNumberProvisioned,
  repairLiveKitSipRouting,
  resolveAgentByCalledNumber,
  resolveAgentRoutingForCall,
  verifyNumberRouting,
} from "./number-assignment";

export { inspectLiveKitSipRouting, diagnoseLiveKitSipIssues } from "./livekit/inspect";
export { rebuildInboundTrunkForNumber } from "./livekit/trunk";

export { ensureSharedDispatchRule } from "./livekit/dispatch";
export { ensureSharedInboundTrunk } from "./livekit/trunk";
export { ensureTelnyxLiveKitFqdnConnection } from "./telnyx/sip-connection";
