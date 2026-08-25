export type {
  LiveKitBackendConfig,
  MediaBackend,
  MediaBackendMode,
  ResolveMediaBackendContext,
} from "./types";

export {
  getLiveKitBackendConfig,
  getMediaBackendMode,
  isMediaBackendConfigured,
} from "./config";

export {
  DEFAULT_MEDIA_BACKEND_MODE,
  LIVEKIT_CLOUD_DISPATCH_RULE_ID,
  LIVEKIT_CLOUD_INBOUND_TRUNK_ID,
  LIVEKIT_SELF_HOSTED_DISPATCH_RULE_ID,
  LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID,
  LIVEKIT_SELF_HOSTED_SIP_HOST,
  LIVEKIT_SELF_HOSTED_STALE_INBOUND_TRUNK_ID,
  LIVEKIT_SELF_HOSTED_WSS_URL,
} from "./constants";

export {
  getLiveKitRoomClientForBackend,
  getLiveKitSipClientForBackend,
  resetLiveKitClientsForTests,
} from "./client";

export {
  getActiveMediaBackend,
  getPinnedMediaBackendForCall,
  parseMediaBackend,
  resolveMediaBackend,
} from "./resolver";

export { mediaBackendMetadataStamp, pinMediaBackendOnCall } from "./pinning";
export { resolveAuthoritativeLiveKitSipHost } from "./sip-host";
