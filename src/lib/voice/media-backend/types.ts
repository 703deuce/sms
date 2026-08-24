/** LiveKit media plane — self-hosted or LiveKit Cloud. */
export type MediaBackend = "self_hosted" | "livekit_cloud";

/** Which backend new calls use. Default `livekit_cloud` preserves existing behavior. */
export type MediaBackendMode = MediaBackend;

export type LiveKitBackendConfig = {
  backend: MediaBackend;
  url: string;
  apiKey: string;
  apiSecret: string;
  sipHost: string;
  inboundTrunkId: string | null;
  outboundTrunkId: string | null;
  dispatchRuleId: string | null;
  inboundTrunkName: string;
  outboundTrunkName: string;
  dispatchRuleName: string;
};

export type ResolveMediaBackendContext = {
  /** Existing call — never change backend mid-call. */
  callId?: string | null;
  /** Hint from dispatch metadata / room metadata. */
  mediaBackend?: MediaBackend | null;
  /** Force backend for tests. */
  forceBackend?: MediaBackend | null;
};
