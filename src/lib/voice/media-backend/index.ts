export type {
  LiveKitBackendConfig,
  MediaBackend,
  MediaBackendHealthSnapshot,
  MediaBackendHealthStatus,
  MediaBackendMode,
  ResolveMediaBackendContext,
} from "./types";

export {
  getAuthoritativeLiveKitSipHostForBackend,
  getLiveKitBackendConfig,
  getMediaBackendMode,
  getSelfHostedTestDid,
  getTelnyxFqdnConnectionNameForBackend,
  getTelnyxStoredFqdnConnectionIdForBackend,
  isMediaBackendConfigured,
  isTelnyxLiveKitFailoverEnabled,
} from "./config";

export {
  getLiveKitRoomClientForBackend,
  getLiveKitSipClientForBackend,
  resetLiveKitClientsForTests,
} from "./client";

export {
  getMediaBackendHealthReport,
  getPinnedMediaBackendForCall,
  inferMediaBackendFromDid,
  parseMediaBackend,
  resolveMediaBackend,
} from "./resolver";

export {
  isMediaBackendHealthy,
  probeMediaBackendHealth,
  resetMediaBackendHealthForTests,
} from "./health";

export { mediaBackendMetadataStamp, pinMediaBackendOnCall } from "./pinning";

export {
  ensureTelnyxFqdnConnectionForBackend,
  ensureTelnyxLiveKitInboundFailover,
  getBackendSipHostSummary,
} from "./telnyx-failover";
