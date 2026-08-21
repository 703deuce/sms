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
  getLiveKitProjectAlignment,
  resolveLiveKitSipHost,
} from "./config";

export {
  parseDispatchAttributes,
  parseJobDispatchMetadata,
  parseRoomMetadata,
  roomMetadataSchema,
  type RoomMetadata,
} from "./metadata";

export {
  buildExplicitDispatchMetadata,
  explicitDispatchPatchForPhoneSettings,
  loadExplicitDispatchForDid,
  mergeExplicitDispatchMetadata,
  type ExplicitDispatchMetadata,
} from "./dispatch-metadata";

export {
  assignNumberToAgent,
  ensureNumberProvisioned,
  fullResetLiveKitSipRouting,
  patchInboundTrunkE164Formats,
  repairLiveKitSipRouting,
  restoreTexmlInboundRoute,
  resolveAgentByCalledNumber,
  resolveAgentRoutingForCall,
  resolveFallbackInboundCalledNumber,
  verifyNumberRouting,
} from "./number-assignment";

export { inspectLiveKitSipRouting, diagnoseLiveKitSipIssues } from "./livekit/inspect";

export { ensureSharedDispatchRule } from "./livekit/dispatch";
export {
  buildLiveKitAgentJobMetadata,
  findDidDispatchRuleByName,
  syncDidDispatchRuleSnapshot,
} from "./livekit/dispatch-snapshot-sync";
export { ensureSharedInboundTrunk } from "./livekit/trunk";
export {
  ensureLiveKitOutboundTrunk,
  findOutboundTrunkByName,
  getStoredLiveKitOutboundTrunkId,
  resolvePlatformOutboundTrunkId,
  resolvePlatformOutboundTrunkIdFromEnv,
  TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME,
} from "./livekit/outbound-trunk";
export { ensureTelnyxLiveKitFqdnConnection } from "./telnyx/sip-connection";
