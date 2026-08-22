import "server-only";

import {
  isMctb571SipDiagnosticTarget,
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_SIP_E2E_LOG_SOURCE,
} from "@/lib/mctb/sip-diagnostic/constants";

export type MctbSipE2eTracePayload = {
  source?: string;
  event: string;
  timestamp?: string;
  correlationId?: string;
  jobId?: string;
  roomName?: string;
  roomSid?: string;
  participantId?: string;
  participantIdentity?: string;
  fromE164?: string;
  toE164?: string;
  forwardedFrom?: string;
  [key: string]: unknown;
};

export function logMctbSipE2eTrace(fields: MctbSipE2eTracePayload): void {
  console.log(
    JSON.stringify({
      service: "transovo-web",
      source: MCTB_SIP_E2E_LOG_SOURCE,
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  );
}

export function logMctbSipE2eMirror(payload: Record<string, unknown>): void {
  logMctbSipE2eTrace({
    event: String(payload.event || "unknown"),
    correlationId:
      typeof payload.correlationId === "string" ? payload.correlationId : undefined,
    jobId: typeof payload.jobId === "string" ? payload.jobId : undefined,
    roomName: typeof payload.roomName === "string" ? payload.roomName : undefined,
    ...payload,
  });
}

export type DispatchEvaluatedInput = {
  toE164?: string | null;
  fromE164?: string | null;
  matched: boolean;
  dispatchRuleId?: string | null;
  dispatchTarget?: string | null;
  roomName?: string | null;
  agentName?: string | null;
  explicitWorkspaceId?: string | null;
  explicitAgentId?: string | null;
  reasonIfNotMatched?: string | null;
  correlationId?: string | null;
};

export function logLivekitDispatchEvaluated(input: DispatchEvaluatedInput): void {
  const mctbRoute = isMctb571SipDiagnosticTarget(input.toE164);
  logMctbSipE2eTrace({
    event: "livekit_dispatch_evaluated",
    correlationId: input.correlationId || undefined,
    toE164: input.toE164 || undefined,
    fromE164: input.fromE164 || undefined,
    matched: input.matched,
    dispatchRuleId: input.dispatchRuleId || undefined,
    dispatchTarget: input.dispatchTarget || undefined,
    roomName: input.roomName || undefined,
    agentName: input.agentName || undefined,
    explicitWorkspaceId: input.explicitWorkspaceId || undefined,
    explicitAgentId: input.explicitAgentId || undefined,
    reasonIfNotMatched: input.reasonIfNotMatched || undefined,
    mctb_sip_route_selected: mctbRoute,
    mctbRouteTarget: mctbRoute ? "mctb_sip_diagnostic_worker" : undefined,
  });
}

export function logLivekitJobNotDispatched(input: {
  reason: string;
  roomName?: string | null;
  participantIdentity?: string | null;
  matchedRule?: string | null;
  correlationId?: string | null;
  toE164?: string | null;
}): void {
  logMctbSipE2eTrace({
    event: "livekit_job_not_dispatched",
    correlationId: input.correlationId || undefined,
    reason: input.reason,
    roomName: input.roomName || undefined,
    participantIdentity: input.participantIdentity || undefined,
    matchedRule: input.matchedRule || undefined,
    toE164: input.toE164 || undefined,
  });
}

export function logTelnyxSipInboundSeen(input: {
  correlationId: string;
  from?: string | null;
  to?: string | null;
  diversion?: string | null;
  forwardedFrom?: string | null;
  sipAttributes?: Record<string, string>;
}): void {
  const attrs = input.sipAttributes || {};
  logMctbSipE2eTrace({
    event: "telnyx_sip_inbound_seen",
    correlationId: input.correlationId,
    sipCallId: input.correlationId,
    from: input.from || undefined,
    to: input.to || undefined,
    diversion: input.diversion || input.forwardedFrom || undefined,
    forwardedFrom: input.forwardedFrom || input.diversion || undefined,
    requestUri: attrs["sip.requestUri"] || attrs["sip.request-uri"],
    transport: attrs["sip.transport"] || attrs["sip.via"],
    contentLength: attrs["sip.contentLength"] || attrs["sip.content-length"],
    contentType: attrs["sip.contentType"] || attrs["sip.content-type"],
    hasSdp: attrs["sip.hasSdp"] || attrs["sip.inviteHasSdp"],
    supported: attrs["sip.supported"],
    require: attrs["sip.require"],
    pEarlyMedia: attrs["sip.pEarlyMedia"] || attrs["sip.PEarlyMedia"],
    contact: attrs["sip.contact"],
    userAgent: attrs["sip.userAgent"] || attrs["sip.user-agent"],
    server: attrs["sip.server"],
    connectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
    note: "web_mirror_or_earliest_observable",
  });
}

export function logTelnyxToLivekitInviteAttempted(input: {
  correlationId: string;
  calledDid?: string | null;
  callerAni?: string | null;
  sipAttributes?: Record<string, string>;
}): void {
  const attrs = input.sipAttributes || {};
  logMctbSipE2eTrace({
    event: "telnyx_to_livekit_invite_attempted",
    correlationId: input.correlationId,
    provider_trace_only: true,
    targetFqdn: attrs["sip.trunkHost"] || "sms-6w01zoya.sip.livekit.cloud",
    targetSipUri: attrs["sip.requestUri"],
    calledDid: input.calledDid || undefined,
    callerAni: input.callerAni || undefined,
    sipCallId: input.correlationId,
    transport: attrs["sip.transport"],
    codecs: attrs["sip.codecs"],
    hasOutboundSdp: attrs["sip.hasSdp"],
    note: "not_observable_from_application_code",
  });
}
