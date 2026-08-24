/** LiveKit media plane — self-hosted Hetzner or LiveKit Cloud. */
export type MediaBackend = "self_hosted" | "livekit_cloud";

/** Admin override for which backend new app-originated calls use. */
export type MediaBackendMode = "auto" | MediaBackend;

export type MediaBackendHealthStatus = "healthy" | "degraded" | "unavailable";

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
  /** Inbound DID when known. */
  toE164?: string | null;
  /** Hint from dispatch metadata / SIP trunk id. */
  mediaBackend?: MediaBackend | null;
  /** Force backend for provisioning or tests. */
  forceBackend?: MediaBackend | null;
};

export type MediaBackendHealthSnapshot = {
  backend: MediaBackend;
  status: MediaBackendHealthStatus;
  checkedAt: string;
  checks: Array<{
    name: string;
    ok: boolean;
    detail?: string;
  }>;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
};
